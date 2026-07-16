'use client'

import React from 'react';
import { useForm } from 'react-hook-form';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Save, Eye, Trash2 } from 'lucide-react';

type FormValues = {
  subject: string;
  body: string;
};

export function ColdEmailComposer({ onTemplateUpdate }: { onTemplateUpdate?: (subject: string, body: string) => void }) {
  const { register, handleSubmit, watch, reset } = useForm<FormValues>({
    defaultValues: {
      subject: '',
      body: '',
    }
  });
  
  const subjectValue = watch('subject');
  const bodyValue = watch('body');

  React.useEffect(() => {
    onTemplateUpdate?.(subjectValue, bodyValue);
  }, [subjectValue, bodyValue, onTemplateUpdate]);
  const charCount = bodyValue?.length || 0;

  const onSubmit = (data: FormValues) => {
    toast.success('Email template saved');
  };

  return (
    <Card className="bg-card flex flex-col h-full">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col h-full">
        <CardContent className="p-6 flex-1 flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-1">Cold Email Composer</h2>
            <p className="text-sm text-muted-foreground">Variables: {`{{company}}`}, {`{{role}}`}, {`{{date}}`}</p>
          </div>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium">Subject</label>
            <Input {...register('subject', { required: true })} placeholder="Email subject..." />
          </div>
          
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex justify-between items-center">
              <label className="text-sm font-medium">Email Body</label>
              <span className="text-xs text-muted-foreground">{charCount} characters</span>
            </div>
            <Textarea 
              {...register('body', { required: true })} 
              className="flex-1 min-h-[200px] resize-none font-mono text-sm" 
              placeholder="Plain text only..." 
            />
          </div>
        </CardContent>
        <CardFooter className="p-6 pt-0 flex justify-between gap-2 border-t mt-auto">
          <Button type="button" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => reset()}>
            <Trash2 className="h-4 w-4 mr-2" /> Clear
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => toast.info('Preview mode')}>
              <Eye className="h-4 w-4 mr-2" /> Preview
            </Button>
            <Button type="submit">
              <Save className="h-4 w-4 mr-2" /> Save Template
            </Button>
          </div>
        </CardFooter>
      </form>
    </Card>
  );
}
