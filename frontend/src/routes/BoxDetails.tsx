import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { fetchBoxes } from '@/store/boxesSlice'
import type { RootState, AppDispatch } from '@/store'
import { apiPatch, apiPostFormData, apiDelete, apiGet } from '@/lib/api'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

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

interface BoxOpeningHistory {
  user: {
    id: number
    username: string
    userType: string
  }
  boxId: string
  timestamp: string
  status: string
  tokenFormat: number
}

export default function BoxDetailsPage() {
  const { boxId } = useParams<{ boxId: string }>()
  const navigate = useNavigate()
  const dispatch = useDispatch<AppDispatch>()
  const { items } = useSelector((state: RootState) => state.boxes)
  const user = useSelector((state: RootState) => state.auth.user)
  const [editingBox, setEditingBox] = useState<Box | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [newEditImages, setNewEditImages] = useState<File[]>([])
  const [newEditPreviews, setNewEditPreviews] = useState<string[]>([])
  const [imagesToDelete, setImagesToDelete] = useState<number[]>([])
  const [openingHistory, setOpeningHistory] = useState<BoxOpeningHistory[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  useEffect(() => {
    dispatch(fetchBoxes())
  }, [dispatch])

  useEffect(() => {
    if (items) {
      const box = items.find((b: Box) => b.boxId === boxId)
      if (box) {
        setEditingBox(box)
      } else {
        // Box not found, redirect to boxes list
        navigate('/boxes')
      }
    }
  }, [items, boxId, navigate])

  useEffect(() => {
    const fetchOpeningHistory = async () => {
      if (!editingBox?.boxId) return

      setLoadingHistory(true)
      try {
        const response = await apiGet(`${import.meta.env.VITE_API_URL}/boxes/${editingBox.boxId}/opening-history`)
        if (!response.ok) {
          throw new Error('Failed to fetch opening history')
        }
        const data = await response.json()
        setOpeningHistory(data)
      } catch (error) {
        console.error('Error fetching opening history:', error)
      } finally {
        setLoadingHistory(false)
      }
    }

    fetchOpeningHistory()
  }, [editingBox?.boxId])

  const handleUpdateBox = async () => {
    if (!user?.id || !editingBox) {
      console.error('No user ID or box data available')
      return
    }

    setIsSubmitting(true)
    try {
      // Update box basic information
      const response = await apiPatch(`${import.meta.env.VITE_API_URL}/boxes/${editingBox.boxId}`, {
        location: editingBox.location,
        pricePerNight: editingBox.pricePerNight ? Number(editingBox.pricePerNight) : null,
      })

      if (!response.ok) {
        throw new Error('Failed to update box')
      }

      // Handle image deletions (if any)
      for (const imageId of imagesToDelete) {
        try {
          const deleteResponse = await apiDelete(`${import.meta.env.VITE_API_URL}/boxes/${editingBox.boxId}/images/${imageId}`)
          if (!deleteResponse.ok) {
            console.warn(`Failed to delete image ${imageId}`)
          }
        } catch (error) {
          console.warn(`Error deleting image ${imageId}:`, error)
        }
      }

      // Handle new image uploads (if any) - upload one by one
      if (newEditImages.length > 0) {
        for (let i = 0; i < newEditImages.length; i++) {
          try {
            const formData = new FormData()
            formData.append('image', newEditImages[i])

            const uploadResponse = await apiPostFormData(`${import.meta.env.VITE_API_URL}/boxes/${editingBox.boxId}/images`, formData)
            if (!uploadResponse.ok) {
              console.warn(`Failed to upload image ${i + 1}`)
            }
          } catch (error) {
            console.warn(`Error uploading image ${i + 1}:`, error)
          }
        }
      }

      // Refresh the boxes list
      dispatch(fetchBoxes())
      // Clean up edit image state
      setNewEditImages([])
      newEditPreviews.forEach((url) => URL.revokeObjectURL(url))
      setNewEditPreviews([])
      setImagesToDelete([])
    } catch (error) {
      console.error('Error updating box:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBox = async () => {
    if (!editingBox) {
      console.error('No box data available')
      return
    }

    if (!confirm(`Are you sure you want to delete Box ${editingBox.boxId}? This action cannot be undone.`)) {
      return
    }

    setIsSubmitting(true)
    try {
      const response = await apiDelete(`${import.meta.env.VITE_API_URL}/boxes/${editingBox.boxId}`)

      if (!response.ok) {
        throw new Error('Failed to delete box')
      }

      // Redirect to boxes list after successful deletion
      navigate('/boxes')
    } catch (error) {
      console.error('Error deleting box:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === 'success' ? 'default' : 'destructive'
    return <Badge variant={variant}>{status}</Badge>
  }

  if (!editingBox) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-center">
          <div className="text-lg font-medium mb-2">Loading box details...</div>
          <div className="text-sm text-muted-foreground">Please wait while we fetch the box information</div>
        </div>
      </div>
    )
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/boxes')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-bold">Box {editingBox.boxId} Details</h1>
        </div>

        <div className="grid gap-6">
          {/* Box Images Display */}
          {editingBox.images && editingBox.images.length > 0 && (
            <Card className="p-4">
              <div className="grid gap-2">
                <Label>Box Images ({editingBox.images.length})</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {[...editingBox.images]
                    .filter((img) => !imagesToDelete.includes(img.id))
                    .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
                    .map((image) => (
                      <div key={image.id} className="relative aspect-square">
                        <img
                          src={`http://${image.imageUrl}`}
                          alt={image.fileName}
                          className="w-full h-full object-cover rounded-lg border"
                          onError={(e) => {
                            e.currentTarget.src =
                              'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjZjNmNGY2Ci8+PHRleHQgeD0iNTAlIiB5PSI1MCUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzlmYTJhOCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIG5vdCBmb3VuZDwvdGV4dD48L3N2Zz4='
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setImagesToDelete((prev) => [...prev, image.id])
                          }}
                          className="absolute -top-2 -right-2 bg-black/70 hover:bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
                        >
                          ×
                        </button>
                        {image.isPrimary && <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-2 py-1 rounded">Primary</div>}
                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-2 py-1 rounded">{Math.round(image.fileSize / 1024)}KB</div>
                      </div>
                    ))}

                  {/* New Images Previews */}
                  {newEditPreviews.map((preview, index) => (
                    <div key={`new-${index}`} className="relative aspect-square">
                      <img src={preview} alt={`New image ${index + 1}`} className="w-full h-full object-cover rounded-lg border border-blue-300" />
                      <button
                        type="button"
                        onClick={() => {
                          const newImages = newEditImages.filter((_, i) => i !== index)
                          const newPreviews = newEditPreviews.filter((_, i) => i !== index)
                          URL.revokeObjectURL(newEditPreviews[index])
                          setNewEditImages(newImages)
                          setNewEditPreviews(newPreviews)
                        }}
                        className="absolute -top-2 -right-2 bg-black/70 hover:bg-black text-white rounded-full w-6 h-6 flex items-center justify-center text-sm transition-colors"
                      >
                        ×
                      </button>
                      <div className="absolute top-1 left-1 bg-blue-500 text-white text-xs px-2 py-1 rounded">New</div>
                    </div>
                  ))}

                  {/* Add New Images Button */}
                  {(editingBox.images?.length || 0) - imagesToDelete.length + newEditImages.length < 10 && (
                    <div className="relative aspect-square">
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={(e) => {
                          const files = Array.from(e.target.files || [])
                          const totalImages = (editingBox.images?.length || 0) - imagesToDelete.length + newEditImages.length + files.length
                          if (totalImages > 10) {
                            alert('Maximum 10 images allowed')
                            return
                          }

                          const newImages = [...newEditImages, ...files]
                          setNewEditImages(newImages)

                          const newPreviews = files.map((file) => URL.createObjectURL(file))
                          setNewEditPreviews((prev) => [...prev, ...newPreviews])
                          e.target.value = ''
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      />
                      <div className="w-full h-full border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center hover:border-gray-400 hover:bg-gray-50 transition-colors cursor-pointer">
                        <Plus className="h-8 w-8 text-gray-400" />
                      </div>
                    </div>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Click × to remove images • Add new images with the + button • Primary image is shown first</div>
              </div>
            </Card>
          )}

          {/* Box Information Form */}
          <Card className="p-4">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label>Box ID</Label>
                <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md text-sm font-medium">{editingBox.boxId}</div>
                <div className="text-xs text-muted-foreground">Box ID cannot be changed</div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-location">Location</Label>
                <Input
                  id="edit-location"
                  value={editingBox.location || ''}
                  onChange={(e) => setEditingBox((prev) => (prev ? { ...prev, location: e.target.value } : null))}
                  placeholder="Enter location"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-pricePerNight">Price per Night</Label>
                <Input
                  id="edit-pricePerNight"
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingBox.pricePerNight || ''}
                  onChange={(e) => setEditingBox((prev) => (prev ? { ...prev, pricePerNight: e.target.value } : null))}
                  placeholder="Enter price per night"
                />
              </div>
            </div>
          </Card>

          {/* Box Opening History */}
          <Card className="p-4">
            <div className="grid gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Opening History</h2>
                <div className="text-sm text-muted-foreground">{openingHistory.length} records</div>
              </div>

              {loadingHistory ? (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">Loading opening history...</div>
                </div>
              ) : openingHistory.length === 0 ? (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">No opening history found</div>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead>User Type</TableHead>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Token Format</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {openingHistory.map((item, index) => (
                      <TableRow key={`${item.boxId}-${item.user.id}-${item.timestamp}-${index}`}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{item.user.username}</div>
                            <div className="text-sm text-muted-foreground">ID: {item.user.id}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{item.user.userType}</Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{new Date(item.timestamp).toLocaleDateString()}</div>
                            <div className="text-sm text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString()}</div>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(item.status)}</TableCell>
                        <TableCell>{item.tokenFormat}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button variant="destructive" onClick={handleDeleteBox} disabled={isSubmitting}>
              {isSubmitting ? 'Deleting...' : 'Delete Box'}
            </Button>
            <Button onClick={handleUpdateBox} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
