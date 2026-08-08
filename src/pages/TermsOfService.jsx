import React from "react";
import { Link } from "react-router-dom";
import { Leaf, FileText, UserCheck, ServerCog, ShieldAlert, Scale, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    icon: FileText,
    title: "Acceptance of Terms",
    body: [
      "By downloading, installing or using SolixX Energy Companion (\"the app\"), you agree to be bound by these Terms of Service. If you do not agree, do not use the app.",
      "These terms apply to all users of the iOS app and the web application.",
    ],
  },
  {
    icon: UserCheck,
    title: "Your Account & Responsibilities",
    body: [
      "You must be at least 18 years old and able to form a binding contract to use the app.",
      "You are responsible for keeping your app account, Anker SOLIX and Octopus Energy credentials accurate and secure.",
      "You are responsible for all activity carried out through the app using your connected accounts, including any changes made to your battery charging mode, backup reserve or EV charger settings.",
      "You agree to provide true, accurate information when configuring your accounts and to keep it up to date.",
    ],
  },
  {
    icon: ServerCog,
    title: "The Service & Third-Party Integrations",
    body: [
      "The app connects to your Anker SOLIX system via an unofficial, community-reverse-engineered cloud API. This API is not endorsed by Anker and may change, rate-limit or stop working at any time without notice.",
      "The app connects to your Octopus Energy account using your own Octopus API key to retrieve tariff and consumption data.",
      "AI-generated charging recommendations are produced by third-party language models based on your data and are suggestions only — they are not guarantees of savings or performance.",
      "We do not warrant that the app, the Anker integration or the Octopus integration will be uninterrupted, accurate or available at all times.",
    ],
  },
  {
    icon: ShieldAlert,
    title: "Acceptable Use",
    body: [
      "You agree to use the app only for your own home energy system and not to attempt to access, control or disrupt any other user's system or data.",
      "You agree not to misuse the app, reverse-engineer it beyond what applicable law permits, or use it for any unlawful or fraudulent purpose.",
      "Automated schedules you enable (such as automatic mode toggling or EV charge rules) act on your system on your behalf; you are responsible for reviewing and configuring them appropriately.",
    ],
  },
  {
    icon: Scale,
    title: "Disclaimers & Limitation of Liability",
    body: [
      "The app is provided \"as is\" and \"as available\" without warranties of any kind, whether express or implied, including fitness for a particular purpose or that it will save you money.",
      "Energy savings figures, tariff calculations and recommendations are estimates and may not reflect your actual bills or savings.",
      "To the maximum extent permitted by law, we are not liable for any indirect, incidental or consequential damages arising from your use of the app, including any effect on your energy system, battery, EV charger or electricity bill.",
      "You use the app and any automated controls at your own risk.",
    ],
  },
  {
    icon: FileText,
    title: "Changes, Termination & Contact",
    body: [
      "We may update or modify these terms from time to time; continued use after changes constitutes acceptance. Material changes will be reflected here with an updated date.",
      "We may suspend or terminate access if you breach these terms. You may stop using the app and remove your connected credentials at any time.",
      "These terms are governed by the laws of England and Wales.",
      "For questions about these terms, please contact the app owner through the app's Settings page.",
    ],
  },
];

export default function TermsOfService() {
  const lastUpdated = "8 August 2026";
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Leaf className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold text-lg">SolixX Energy Companion</span>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to app</Link>
          </Button>
        </div>
      </header>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="flex items-center gap-2 text-primary mb-3">
          <FileText className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Terms of Service</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Terms of Service
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          These terms govern your use of SolixX Energy Companion. Please read them carefully
          before connecting your Anker SOLIX and Octopus Energy accounts.
        </p>
        <p className="text-xs text-muted-foreground mt-4">Last updated: {lastUpdated}</p>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 space-y-4">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardContent className="p-5 sm:p-6">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="font-heading text-lg font-semibold pt-1.5">{s.title}</h2>
                </div>
                <ul className="space-y-2 text-sm leading-relaxed text-muted-foreground pl-1">
                  {s.body.map((line, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary/50 mt-1.5 shrink-0" />
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}

        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SolixX Energy Companion. See our{" "}
            <Link to="/privacy-policy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}