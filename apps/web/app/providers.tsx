"use client";

import type { ReactNode } from "react";
import { CallScreen } from "@/components/social/call-screen";
import { AuthProvider } from "@/lib/auth-context";
import { CallProvider } from "@/lib/call-context";
import { I18nProvider } from "@/lib/i18n";
import { SocialProvider } from "@/lib/social-context";
import { VoiceProvider } from "@/lib/voice-context";
import { ServiceWorker } from "@/components/service-worker";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        <VoiceProvider>
          <CallProvider>
            <SocialProvider>
              <ServiceWorker />
              {children}
              <CallScreen />
            </SocialProvider>
          </CallProvider>
        </VoiceProvider>
      </AuthProvider>
    </I18nProvider>
  );
}
