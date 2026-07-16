'use client'

import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { UploadCloud, FileText, Trash2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import { getStoredUser } from '@/lib/google-auth';

export function ResumeManager({ onResumeUpdate }: { onResumeUpdate?: (fileName: string | null) => void }) {
  const [resume, setResume] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Sync with parent whenever local resume state changes
  React.useEffect(() => {
    onResumeUpdate?.(resume);
  }, [resume, onResumeUpdate]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const user = getStoredUser();
      if (!user) {
        toast.error('You must be logged in to upload a resume.');
        return;
      }

      const fileExt = file.name.split('.').pop();
      const safeEmail = user.email.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `${safeEmail}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('ineedjob')
        .upload(fileName, file);

      if (uploadError) {
        throw uploadError;
      }

      setResume(file.name);
      toast.success('Resume uploaded to Supabase Storage');
    } catch (error: unknown) {
      const err = error as Error;
      toast.error('Upload failed: ' + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    setResume(null);
    toast.success('Resume removed from view');
  };

  return (
    <Card className="bg-card">
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold tracking-tight mb-4">Resume Manager</h2>
        
        {!resume ? (
          <div className="border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center justify-center text-center gap-4">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <UploadCloud className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">No resume uploaded.</p>
              <p className="text-sm text-muted-foreground mt-1">Upload a PDF to store securely.</p>
            </div>
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf"
                onChange={handleUpload}
                disabled={isUploading}
              />
              <Button disabled={isUploading}>
                {isUploading ? 'Uploading...' : 'Browse Files'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <div>
                  <p className="font-medium text-sm">{resume}</p>
                  <div className="flex items-center gap-1 mt-1 text-xs text-green-600 dark:text-green-500">
                    <CheckCircle2 className="h-3 w-3" /> Uploaded successfully
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={handleRemove} className="text-destructive hover:text-destructive hover:bg-destructive/10">
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
            <div className="relative">
              <input
                type="file"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                accept=".pdf"
                onChange={handleUpload}
                disabled={isUploading}
              />
              <Button variant="outline" className="w-full" disabled={isUploading}>
                <UploadCloud className="h-4 w-4 mr-2" />
                {isUploading ? 'Replacing...' : 'Replace Resume'}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
