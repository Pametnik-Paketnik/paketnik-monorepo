import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

interface InventoryItem {
  id: number
  name: string
  description: string
  price: number
  isAvailable: boolean
  stockQuantity: number
  hostId: number
}

export default function InventoryDetailsPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [item, setItem] = useState<InventoryItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', description: '', price: 0, stockQuantity: 0, isAvailable: true })
  const [isEditing, setIsEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchItem = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to fetch inventory item')
        const data = await response.json()
        setItem(data)
        setEditData({
          name: data.name,
          description: data.description,
          price: Number(data.price),
          stockQuantity: data.stockQuantity,
          isAvailable: data.isAvailable,
        })
      } catch {
        setError('Failed to load inventory item')
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchItem()
  }, [id, token])

  const handleEdit = async () => {
    if (!item) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items/${item.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      })
      if (!response.ok) throw new Error('Failed to update inventory item')
      const updated = await response.json()
      setItem(updated)
      setIsEditing(false)
      toast.success('Inventory item updated successfully')
    } catch {
      toast.error('Failed to update inventory item')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!item) return
    if (!window.confirm('Are you sure you want to delete this item?')) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items/${item.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error('Failed to delete inventory item')
      toast.success('Inventory item deleted')
      navigate('/inventory')
    } catch {
      toast.error('Failed to delete inventory item')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (error || !item) return <div className="flex items-center justify-center min-h-screen text-red-500">{error || 'Item not found'}</div>

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/inventory')}>
            Back
          </Button>
          <h1 className="text-2xl font-bold">Inventory Item #{item.id}</h1>
        </div>
        <Card className="p-4">
          {isEditing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={editData.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Input id="description" value={editData.description} onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="price">Price</Label>
                <Input id="price" type="number" step="0.01" value={editData.price} onChange={(e) => setEditData((d) => ({ ...d, price: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stockQuantity">Stock Quantity</Label>
                <Input id="stockQuantity" type="number" value={editData.stockQuantity} onChange={(e) => setEditData((d) => ({ ...d, stockQuantity: Number(e.target.value) }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="isAvailable">Available</Label>
                <input id="isAvailable" type="checkbox" checked={editData.isAvailable} onChange={(e) => setEditData((d) => ({ ...d, isAvailable: e.target.checked }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <span className="font-medium">Name:</span> {item.name}
              </div>
              <div>
                <span className="font-medium">Description:</span> {item.description}
              </div>
              <div>
                <span className="font-medium">Price:</span> ${item.price}
              </div>
              <div>
                <span className="font-medium">Stock Quantity:</span> {item.stockQuantity}
              </div>
              <div>
                <span className="font-medium">Available:</span> {item.isAvailable ? 'Yes' : 'No'}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
                <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                  Delete
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
