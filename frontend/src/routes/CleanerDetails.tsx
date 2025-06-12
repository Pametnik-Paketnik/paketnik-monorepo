import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
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

interface CleanerDetailsPageProps {
  isAdd?: boolean
}

export default function CleanerDetailsPage({ isAdd = false }: CleanerDetailsPageProps) {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const token = useSelector((state: RootState) => state.auth.accessToken)
  const [cleaner, setCleaner] = useState<Cleaner | null>(null)
  const [loading, setLoading] = useState(!isAdd)
  const [error, setError] = useState<string | null>(null)
  const [editData, setEditData] = useState({ name: '', surname: '', email: '' })
  const [isEditing, setIsEditing] = useState(isAdd)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const fetchCleaner = async () => {
      if (isAdd) return
      setLoading(true)
      setError(null)
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/cleaners/${id}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })
        if (!response.ok) throw new Error('Failed to fetch cleaner')
        const data = await response.json()
        setCleaner(data)
        setEditData({ name: data.name, surname: data.surname, email: data.email })
      } catch {
        setError('Failed to load cleaner')
      } finally {
        setLoading(false)
      }
    }
    if (token && !isAdd) fetchCleaner()
  }, [id, token, isAdd])

  const handleEdit = async () => {
    if (!cleaner) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/cleaners/${cleaner.id}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      })
      if (!response.ok) throw new Error('Failed to update cleaner')
      const updated = await response.json()
      setCleaner(updated)
      setIsEditing(false)
      toast.success('Cleaner updated successfully')
    } catch {
      toast.error('Failed to update cleaner')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!cleaner) return
    if (!window.confirm('Are you sure you want to delete this cleaner?')) return
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/cleaners/${cleaner.id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      })
      if (!response.ok) throw new Error('Failed to delete cleaner')
      toast.success('Cleaner deleted')
      navigate('/cleaners')
    } catch {
      toast.error('Failed to delete cleaner')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreate = async () => {
    setIsSubmitting(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/cleaners`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(editData),
      })
      if (!response.ok) throw new Error('Failed to create cleaner')
      toast.success('Cleaner created successfully')
      navigate('/cleaners')
    } catch {
      toast.error('Failed to create cleaner')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  if (error || (!isAdd && !cleaner)) return <div className="flex items-center justify-center min-h-screen text-red-500">{error || 'Cleaner not found'}</div>

  return (
    <div className="@container/main flex flex-1 flex-col gap-2 px-4 md:px-6 lg:px-8">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate('/cleaners')}>
            Back
          </Button>
          <h1 className="text-2xl font-bold">{isAdd ? 'Add New Cleaner' : `Cleaner #${cleaner?.id}`}</h1>
        </div>
        <Card className="p-4">
          {isEditing ? (
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name</Label>
                <Input id="name" value={editData.name} onChange={(e) => setEditData((d) => ({ ...d, name: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="surname">Surname</Label>
                <Input id="surname" value={editData.surname} onChange={(e) => setEditData((d) => ({ ...d, surname: e.target.value }))} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={editData.email} onChange={(e) => setEditData((d) => ({ ...d, email: e.target.value }))} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={isAdd ? handleCreate : handleEdit} disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : isAdd ? 'Create' : 'Save'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4">
              <div>
                <span className="font-medium">Name:</span> {cleaner?.name}
              </div>
              <div>
                <span className="font-medium">Surname:</span> {cleaner?.surname}
              </div>
              <div>
                <span className="font-medium">Email:</span> {cleaner?.email}
              </div>
              <div>
                <span className="font-medium">User Type:</span> {cleaner?.userType}
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setIsEditing(true)}>Edit</Button>
                {!isAdd && (
                  <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting}>
                    Delete
                  </Button>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
