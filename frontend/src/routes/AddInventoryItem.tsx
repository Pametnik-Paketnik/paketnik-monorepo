import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export default function AddInventoryItemPage() {
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [form, setForm] = useState({
    name: '',
    description: '',
    price: 0,
    stockQuantity: 0,
    isAvailable: true,
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) {
      toast.error('You must be logged in to add inventory items')
      return
    }
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      })
      if (!response.ok) throw new Error('Failed to add inventory item')
      toast.success('Inventory item added successfully')
      navigate('/inventory')
    } catch {
      toast.error('Failed to add inventory item')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 max-w-4xl mx-auto w-full">
        <h1 className="text-2xl font-bold">Add Inventory Item</h1>
        <Card className="p-6">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g., Premium Toilet Paper" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="e.g., Soft 3-ply toilet paper, pack of 12 rolls"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="price">Price</Label>
              <Input id="price" type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stockQuantity">Stock Quantity</Label>
              <Input
                id="stockQuantity"
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, stockQuantity: parseInt(e.target.value) }))}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="availability">Availability</Label>
              <Select value={form.isAvailable ? 'available' : 'unavailable'} onValueChange={(value) => setForm((f) => ({ ...f, isAvailable: value === 'available' }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select availability" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">Available</SelectItem>
                  <SelectItem value="unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" type="button" onClick={() => navigate('/inventory')} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Adding...' : 'Add Item'}
              </Button>
            </div>
          </form>
        </Card>
      </div>
    </div>
  )
}
