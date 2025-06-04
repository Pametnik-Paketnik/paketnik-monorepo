import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBoxes } from '@/store/boxesSlice';
import type { RootState, AppDispatch } from '@/store';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface Box {
  id: number;
  name: string | null;
  hostId: number | null;
  [key: string]: any; // For other potential fields
}

export default function BoxesPage() {
  const dispatch = useDispatch<AppDispatch>();
  const { items, loading, error } = useSelector((state: RootState) => state.boxes);
  const [selectedBox, setSelectedBox] = useState<Box | null>(null);

  useEffect(() => {
    dispatch(fetchBoxes());
  }, [dispatch]);

  return (
    <div key="page-container" className="@container/main flex flex-1 flex-col gap-2">
      <div key="content-container" className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
        <Card key="boxes-card">
          <CardHeader key="boxes-header">
            <CardTitle key="boxes-title">Boxes</CardTitle>
          </CardHeader>
          <CardContent key="boxes-content">
            {loading && <div key="loading">Loading...</div>}
            {error && <div key="error" className="text-red-500">{error}</div>}
            <div key="table-container" className="overflow-x-auto">
              <table className="min-w-full border text-sm">
                <thead>
                  <tr className="bg-muted" key="header-row">
                    <th key="id" className="px-4 py-2 border">ID</th>
                    <th key="name" className="px-4 py-2 border">Name</th>
                    <th key="host" className="px-4 py-2 border">Host</th>
                    <th key="actions" className="px-4 py-2 border">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((box: Box) => (
                    <tr key={`row-${box.id}`} className="border-b">
                      <td key={`${box.id}-id`} className="px-4 py-2 border">{box.id}</td>
                      <td key={`${box.id}-name`} className="px-4 py-2 border">{box.name || '-'}</td>
                      <td key={`${box.id}-host`} className="px-4 py-2 border">{box.hostId || '-'}</td>
                      <td key={`${box.id}-actions`} className="px-4 py-2 border">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => setSelectedBox(box)}
                        >
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

      <Dialog open={!!selectedBox} onOpenChange={() => setSelectedBox(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Box Details</DialogTitle>
            <DialogDescription>
              Detailed information about the selected box
            </DialogDescription>
          </DialogHeader>
          {selectedBox && (
            <div className="grid gap-4 py-4">
              {Object.entries(selectedBox).map(([key, value]) => (
                <div key={key} className="grid grid-cols-4 items-center gap-4">
                  <div className="font-medium">{key}</div>
                  <div className="col-span-3">{value?.toString() || '-'}</div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
