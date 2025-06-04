import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchReservations } from '@/store/reservationsSlice';
import type { RootState, AppDispatch } from '@/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function ReservationsPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error } = useSelector((state: RootState) => state.reservations);

  useEffect(() => {
    dispatch(fetchReservations());
  }, [dispatch]);

  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <Card>
          <CardHeader>
            <CardTitle>Reservations</CardTitle>
          </CardHeader>
          <CardContent>
            {loading && <div>Loading...</div>}
            {error && <div className="text-red-500">{error}</div>}
            <div className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-muted">
                    <th className="px-4 py-2 border">ID</th>
                    <th className="px-4 py-2 border">Guest</th>
                    <th className="px-4 py-2 border">Host</th>
                    <th className="px-4 py-2 border">Box</th>
                    <th className="px-4 py-2 border">Status</th>
                    <th className="px-4 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((reservation: any) => (
                    <tr key={reservation.id} className="border-b">
                      <td className="px-4 py-2 border">{reservation.id}</td>
                      <td className="px-4 py-2 border">{reservation.guestId || '-'}</td>
                      <td className="px-4 py-2 border">{reservation.hostId || '-'}</td>
                      <td className="px-4 py-2 border">{reservation.boxId || '-'}</td>
                      <td className="px-4 py-2 border">{reservation.status || '-'}</td>
                      <td className="px-4 py-2 border">
                        <Button size="sm" variant="outline" onClick={() => alert(JSON.stringify(reservation, null, 2))}>
                          Details
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 