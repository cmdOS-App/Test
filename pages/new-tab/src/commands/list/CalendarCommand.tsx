import { SiGooglecalendar } from 'react-icons/si';
import { CommandModule } from '../types';
import React from 'react';

const SYSTEM_PROMPT =
  'Act as a professional AI personal assistant and calendar manager. Access the Google Calendar. Optimize the schedule for productivity, allow for breaks, and manage conflicts. When scheduling, consider existing appointments.';

export const CalendarCommand: CommandModule = {
  id: 'calendar',
  // Use a colored icon component instance
  icon: <SiGooglecalendar className="text-[#4285F4]" />,
  label: 'Calendar Event AI Agent',
  prefix: '/calendar',
  keywords: ['calendar', 'schedule', 'meeting', 'event', 'agenda', 'ai', 'call'],
  behavior: 'instant',

  execute: async context => {
    const { services, prompt } = context;

    const fullPrompt = prompt ? `${SYSTEM_PROMPT} ${prompt}` : SYSTEM_PROMPT;

    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      chrome.runtime.sendMessage(
        {
          action: 'open_tab_with_auto_submit',
          url: 'https://gemini.google.com/app',
          autoSubmit: {
            kind: 'gemini', // Use 'gemini' generic handler since we are providing the full prompt here
            prompt: fullPrompt,
          },
          forceNewTab: true,
        },
        response => {
          if (!response || !response.ok) {
            console.error('Failed to open calendar agent:', response?.error);
            if (services.toast) services.toast('Failed to open Calendar Agent', 'error');
          }
        },
      );
    } else {
      if (services.toast) services.toast('Chrome runtime not available', 'error');
    }
  },
};
