import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

interface InventoryItem {
  id: number
  name: string
  description: string
  price: number
  isAvailable: boolean
  stockQuantity: number
  hostId: number
}

export default function InventoryListPage() {
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [items, setItems] = useState<InventoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/inventory-items`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to fetch inventory items')
        const data = await response.json()
        setItems(data)
      } catch {
        setError('Failed to load inventory items')
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchItems()
  }, [token])

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Inventory</h1>
          <Button onClick={() => navigate('/inventory/add')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Item
          </Button>
        </div>
        {loading && <div>Loading inventory...</div>}
        {error && <div className="text-red-500">{error}</div>}
        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <Card
                key={item.id}
                className="flex flex-col overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => navigate(`/inventory/${item.id}`)}
              >
                <div className="p-4 flex-1">
                  <h3 className="text-lg font-semibold mb-2">{item.name}</h3>
                  <div className="text-sm text-muted-foreground mb-1">{item.description}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Price:</span>
                    <span className="text-sm font-medium">${Number(item.price).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Stock:</span>
                    <span className="text-sm font-medium">{item.stockQuantity}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Available:</span>
                    <span className="text-sm font-medium">{item.isAvailable ? 'Yes' : 'No'}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && !error && items.length === 0 && <div>No inventory items found.</div>}
      </div>
    </div>
  )
}
