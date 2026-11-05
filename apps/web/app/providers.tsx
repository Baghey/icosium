"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider } from "@/lib/i18n";
import { SocialProvider } from "@/lib/social-context";
import { VoiceProvider } from "@/lib/voice-context";
import { ServiceWorker } from "@/components/service-worker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <VoiceProvider>
          <SocialProvider>
            <ServiceWorker />
            {children}
          </SocialProvider>
        </VoiceProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
