import { useEffect, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { useNavigate } from 'react-router-dom'
import { fetchBoxes } from '@/store/boxesSlice'
import type { RootState, AppDispatch } from '@/store'
import { apiPost, apiPostFormData } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus } from 'lucide-react'

interface BoxImage {
  id: number
  imageKey: string
  fileName: string
  mimeType: string
  fileSize: number
  imageUrl: string
  isPrimary: boolean
  createdAt: string
}

interface Box {
  id: string
  boxId: string
  name: string | null
  location: string | null
  hostId: number | null
  pricePerNight: string | number
  images?: BoxImage[]
}

export default function BoxesPage() {
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const { items, loading, error } = useSelector((state: RootState) => state.boxes)
  const user = useSelector((state: RootState) => state.auth.user)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [newBoxData, setNewBoxData] = useState({
    boxId: '',
    location: '',
    pricePerNight: '',
  })
  const [selectedImages, setSelectedImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [primaryImageIndex, setPrimaryImageIndex] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [addBoxError, setAddBoxError] = useState<string | null>(null)

  useEffect(() => {
    dispatch(fetchBoxes())
  }, [dispatch])

  const validItems = (items as Box[]).filter((item) => {
    const hasId = item && typeof item.boxId === 'string' && item.boxId.length > 0
    return hasId
  })

  // Handle image selection and create previews
  const handleImageSelection = (files: File[]) => {
    const totalImages = selectedImages.length + files.length
    if (totalImages > 10) {
      setAddBoxError('Maximum 10 images allowed')
      return
    }

    // Append to existing images instead of replacing
    const newImages = [...selectedImages, ...files]
    setSelectedImages(newImages)
    setAddBoxError(null)

    // Create preview URLs for new files only
    const newPreviews = files.map((file) => URL.createObjectURL(file))
    setImagePreviews((prev) => [...prev, ...newPreviews])
  }

  // Remove a specific image
  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index)
    const newPreviews = imagePreviews.filter((_, i) => i !== index)

    // Clean up the removed preview URL
    URL.revokeObjectURL(imagePreviews[index])

    setSelectedImages(newImages)
    setImagePreviews(newPreviews)

    // Adjust primary image index if necessary
    if (index === primaryImageIndex) {
      setPrimaryImageIndex(0) // Reset to first image
    } else if (index < primaryImageIndex) {
      setPrimaryImageIndex(primaryImageIndex - 1) // Shift index down
    }
  }

  // Set primary image
  const setPrimaryImage = (index: number) => {
    setPrimaryImageIndex(index)
  }

  // Clean up preview URLs when component unmounts or images change
  useEffect(() => {
    return () => {
      imagePreviews.forEach((url) => URL.revokeObjectURL(url))
    }
  }, [imagePreviews])

  const handleAddBox = async () => {
    if (!user?.id) {
      setAddBoxError('No user ID available')
      return
    }

    // Reset any previous errors
    setAddBoxError(null)
    setIsSubmitting(true)

    try {
      let response

      if (selectedImages.length > 0) {
        // Use FormData for requests with images
        const formData = new FormData()
        formData.append('boxId', newBoxData.boxId)
        formData.append('location', newBoxData.location)
        formData.append('ownerId', user.id.toString())
        formData.append('pricePerNight', newBoxData.pricePerNight)

        // Append images with primary image first
        const reorderedImages = [...selectedImages]
        if (primaryImageIndex > 0) {
          // Move primary image to first position
          const primaryImage = reorderedImages.splice(primaryImageIndex, 1)[0]
          reorderedImages.unshift(primaryImage)
        }

        reorderedImages.forEach((image) => {
          formData.append('images', image)
        })

        response = await apiPostFormData(`${import.meta.env.VITE_API_URL}/boxes`, formData)
      } else {
        // Use regular JSON request when no images
        response = await apiPost(`${import.meta.env.VITE_API_URL}/boxes`, {
          ...newBoxData,
          ownerId: user.id,
          pricePerNight: Number(newBoxData.pricePerNight),
        })
      }

      if (!response.ok) {
        // Try to parse error response
        let errorMessage = 'Failed to add box'
        try {
          const errorData = await response.json()
          if (errorData.message) {
            errorMessage = errorData.message
          } else if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch {
          // If parsing fails, use status text
          errorMessage = response.statusText || errorMessage
        }

        // Handle specific error cases
        if (response.status === 409) {
          errorMessage = `Box with ID "${newBoxData.boxId}" already exists. Please choose a different ID.`
        } else if (response.status === 400) {
          errorMessage = 'Invalid data provided. Please check all fields.'
        } else if (response.status === 401) {
          errorMessage = 'You are not authorized to create boxes.'
        }

        throw new Error(errorMessage)
      }

      // Success - refresh the boxes list and close dialog
      dispatch(fetchBoxes())
      setIsAddDialogOpen(false)
      setNewBoxData({
        boxId: '',
        location: '',
        pricePerNight: '',
      })
      setSelectedImages([])
      setPrimaryImageIndex(0)

      // Clean up image previews
      imagePreviews.forEach((url) => URL.revokeObjectURL(url))
      setImagePreviews([])
    } catch (error) {
      console.error('Error adding box:', error)
      setAddBoxError(error instanceof Error ? error.message : 'An unexpected error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div key="page-container" className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div key="content-container" className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Boxes</h1>
          <Button onClick={() => setIsAddDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Box
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">Loading boxes...</div>
              <div className="text-sm text-muted-foreground">Please wait while we fetch your boxes</div>
            </div>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center text-red-500">
              <div className="text-lg font-medium mb-2">Error loading boxes</div>
              <div className="text-sm">{error}</div>
            </div>
          </div>
        )}

        {!loading && !error && validItems.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {validItems.map((box) => {
              const primaryImage = box.images?.find((img) => img.isPrimary) || box.images?.[0]
              const hasImages = box.images && box.images.length > 0

              return (
                <Card
                  key={`box-${box.boxId}`}
                  className="flex flex-col overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
                  onClick={() => navigate(`/boxes/${box.boxId}`)}
                >
                  {/* Image Section */}
                  <div className="relative h-48 bg-gray-100">
                    {hasImages && primaryImage ? (
                      <>
                        <img
                          src={`http://${primaryImage.imageUrl}`}
                          alt={`Box ${box.boxId}`}
                          className="w-full h-full object-cover rounded-t-lg"
                          onError={(e) => {
                            // Hide image if failed to load
                            e.currentTarget.style.display = 'none'
                          }}
                        />
                        {box.images && box.images.length > 1 && (
                          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">+{box.images.length - 1} more</div>
                        )}
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 rounded-t-lg">
                        <div className="text-center">
                          <div className="text-2xl mb-1">📦</div>
                          <div className="text-sm">No Image</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 flex-1">
                    <h3 className="text-lg font-semibold mb-3">Box {box.boxId}</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Location:</span>
                        <span className="text-sm font-medium">{box.location || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Price per night:</span>
                        <span className="text-sm font-medium">${Number(box.pricePerNight || 0).toFixed(2)}</span>
                      </div>
                      {hasImages && (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Images:</span>
                          <span className="text-sm font-medium">{box.images?.length || 0}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {!loading && !error && validItems.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="text-lg font-medium mb-2">No boxes found</div>
              <div className="text-sm text-muted-foreground">You don't have any boxes yet</div>
            </div>
          </div>
        )}
      </div>

      {/* Add Box Dialog */}
      <Dialog
        open={isAddDialogOpen}
        onOpenChange={(open) => {
          setIsAddDialogOpen(open)
          if (!open) {
            // Clean up when closing dialog
            setAddBoxError(null)
            setSelectedImages([])
            imagePreviews.forEach((url) => URL.revokeObjectURL(url))
            setImagePreviews([])
            setPrimaryImageIndex(0)
            setNewBoxData({
              boxId: '',
              location: '',
              pricePerNight: '',
            })
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add New Box</DialogTitle>
            <DialogDescription>Fill in the details to add a new box</DialogDescription>
          </DialogHeader>

          {addBoxError && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
              <div className="flex">
                <div className="text-red-800 text-sm">{addBoxError}</div>
              </div>
            </div>
          )}

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="boxId">Box ID</Label>
              <Input
                id="boxId"
                value={newBoxData.boxId}
                onChange={(e) => setNewBoxData((prev) => ({ ...prev, boxId: e.target.value }))}
                placeholder="Enter box ID (e.g., BOX126)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={newBoxData.location}
                onChange={(e) => setNewBoxData((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Enter box location"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pricePerNight">Price per Night</Label>
              <Input
                id="pricePerNight"
                type="number"
                step="0.01"
                min="0"
                value={newBoxData.pricePerNight}
                onChange={(e) => setNewBoxData((prev) => ({ ...prev, pricePerNight: e.target.value }))}
                placeholder="Enter price per night"
              />
            </div>
            <div className="grid gap-2">
              <Label>Images (Optional - Max 10)</Label>

              {/* Custom File Input and Image Previews Grid */}
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {/* Image Previews */}
                {imagePreviews.map((preview, index) => (
                  <div key={index} className="relative group aspect-square">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => setPrimaryImage(index)}
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 bg-black/70 hover:bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
                    >
                      ×
                    </button>
                    {index === primaryImageIndex && <div className="absolute bottom-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">Primary</div>}
                  </div>
                ))}

                {/* Add Images Button */}
                {selectedImages.length < 10 && (
                  <div className="relative aspect-square">
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      onChange={(e) => {
                        const files = Array.from(e.target.files || [])
                        handleImageSelection(files)
                        e.target.value = '' // Reset input to allow selecting same files again
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                      <Plus className="h-8 w-8 text-gray-400" />
                    </div>
                  </div>
                )}
              </div>

              {selectedImages.length > 0 && <div className="text-sm text-muted-foreground">{selectedImages.length} image(s) selected • Click image to set as primary</div>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button onClick={handleAddBox} disabled={isSubmitting || !newBoxData.boxId || !newBoxData.location || !newBoxData.pricePerNight}>
              {isSubmitting ? 'Adding...' : 'Add Box'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
