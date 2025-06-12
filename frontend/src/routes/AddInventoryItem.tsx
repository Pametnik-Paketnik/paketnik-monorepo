import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function AddInventoryItemPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', description: '', quantity: 1 })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold">Add Inventory Item</h1>
        <Card className="p-4">
          <form onSubmit={handleSubmit} className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input id="quantity" type="number" min={1} value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))} required />
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
