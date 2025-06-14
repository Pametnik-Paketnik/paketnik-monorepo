import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

interface Cleaner {
  id: number
  name: string
  surname: string
  email: string
  userType: string
  createdAt: string
  updatedAt: string
}

export default function CleanersListPage() {
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [cleaners, setCleaners] = useState<Cleaner[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCleaners = async () => {
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/cleaners`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to fetch cleaners')
        const data = await response.json()
        setCleaners(data)
      } catch {
        setError('Failed to load cleaners')
      } finally {
        setLoading(false)
      }
    }
    if (token) fetchCleaners()
  }, [token])

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Cleaners</h1>
          <Button onClick={() => navigate('/cleaners/add')} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Cleaner
          </Button>
        </div>
        {loading && <div>Loading cleaners...</div>}
        {error && <div className="text-red-500">{error}</div>}
        {!loading && !error && cleaners.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {cleaners.map((cleaner) => (
              <Card
                key={cleaner.id}
                className="flex flex-col overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-200"
                onClick={() => navigate(`/cleaners/${cleaner.id}`)}
              >
                <div className="p-4 flex-1">
                  <h3 className="text-lg font-semibold mb-2">
                    {cleaner.name} {cleaner.surname}
                  </h3>
                  <div className="text-sm text-muted-foreground mb-1">{cleaner.email}</div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">User Type:</span>
                    <span className="text-sm font-medium">{cleaner.userType}</span>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!loading && !error && cleaners.length === 0 && <div>No cleaners found.</div>}
      </div>
    </div>
  )
}
