import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AIChatPanel } from '@/components/subject/AIChatPanel';
import { useUser } from '@/contexts/UserContext';
import adomoLogo from '@/assets/protibha-logo.png';

export function FloatingAIButton() {
  const [isOpen, setIsOpen] = useState(false);
  const { user } = useUser();

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-[72px] right-4 z-40 w-12 h-12 rounded-full shadow-lg gradient-primary glow-sm hover:scale-105 active:scale-95 transition-transform p-0 overflow-hidden"
        aria-label="Open AI Tutor"
      >
        <img
          src={adomoLogo}
          alt="Adomo AI"
          className="w-8 h-8 object-contain"
        />
      </Button>

      <Sheet open={isOpen} onOpenChange={setIsOpen}>
        <SheetContent
          side="bottom"
          className="h-[85vh] rounded-t-2xl p-0 bg-background border-t border-border"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>AI Tutor Chat</SheetTitle>
          </SheetHeader>

          <div className="flex justify-center pt-2.5 pb-1">
            <div className="w-10 h-1 rounded-full bg-muted-foreground/25" />
          </div>

          <div className="h-[calc(85vh-20px)] overflow-hidden">
            <AIChatPanel
              subjectName="General Study"
              lessonContext={`Student: ${user.name}, Class: ${user.class_level}, School: ${user.school_name}`}
            />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
