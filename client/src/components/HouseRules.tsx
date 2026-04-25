"use client";

import {
  ClipboardXIcon,
  EyeIcon,
  HandIcon,
  ScrollTextIcon,
  SmileIcon,
  TimerIcon,
  ZapIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const RULES: Array<{ icon: typeof ZapIcon; text: string }> = [
  {
    icon: ZapIcon,
    text: "Type a real word that bridges the two letters. First valid answer wins.",
  },
  {
    icon: ClipboardXIcon,
    text: "Cmd+V is not a word.",
  },
  {
    icon: EyeIcon,
    text: "'Researching' mid-round is never the answer.",
  },
  {
    icon: TimerIcon,
    text: "Pickers, choose fast. Dawdle and the dictionary picks for you.",
  },
  {
    icon: HandIcon,
    text: "Cursed letters? Vote skip. Unanimous = the round dies, no one has to suffer.",
  },
  {
    icon: ScrollTextIcon,
    text: "Same word can't be reused in this room. Make fresh mistakes.",
  },
  {
    icon: SmileIcon,
    text: "It's words and pride. Trust your brain, type fast, take the L gracefully.",
  },
];

export function HouseRules() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-muted-foreground inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em]">
          <ScrollTextIcon className="size-3.5" />
          House rules
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-2.5">
          {RULES.map((r, i) => {
            const Icon = r.icon;
            return (
              <li key={i} className="flex items-start gap-2.5">
                <Icon className="text-muted-foreground mt-0.5 size-3.5 shrink-0" />
                <span className="text-muted-foreground text-xs leading-relaxed">
                  {r.text}
                </span>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
