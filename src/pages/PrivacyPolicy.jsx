import React from "react";
import { Link } from "react-router-dom";
import { Leaf, Shield, Lock, Database, Server, Mail, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const SECTIONS = [
  {
    icon: Database,
    title: "Information We Collect",
    body: [
      "Account information: your email address and name, used to identify you within the app.",
      "Energy device data: telemetry from your Anker SOLIX X1 system, including battery level, solar generation, home usage, grid flow and EV charger power.",
      "Tariff and consumption data: electricity tariff rates and half-hourly consumption retrieved from your Octopus Energy account.",
      "Connection credentials: your Anker and Octopus Energy login details, stored securely in an encrypted secrets store and used only to retrieve your own data.",
    ],
  },
  {
    icon: Server,
    title: "How We Use Your Information",
    body: [
      "To display real-time energy generation, storage and consumption on your dashboard.",
      "To calculate savings and visualize trends over time.",
      "To run tariff-aware optimisation, automation rules and AI-generated charging plans for your battery and EV charger.",
      "To send you optional email alerts about your energy savings.",
      "We never sell your data or share it with advertisers.",
    ],
  },
  {
    icon: Lock,
    title: "Data Storage & Security",
    body: [
      "Your data is stored in the secure Base44 cloud platform, hosted on managed infrastructure with encryption in transit.",
      "API credentials for Anker and Octopus are kept in an encrypted secrets vault and are never exposed to the client.",
      "Each user can only access their own device, tariff and reading records — access is enforced at the database level.",
    ],
  },
  {
    icon: ExternalLink,
    title: "Third-Party Services",
    body: [
      "Anker SOLIX cloud API — to read and control your energy storage system on your behalf.",
      "Octopus Energy API — to retrieve tariff rates and smart-meter consumption.",
      "OpenAI / Google Gemini — to generate AI-driven charging recommendations based on your usage and tariff (no personal data is sold to these providers).",
      "Apple App Store — used to deliver the app to your device. Apple's privacy policy applies to App Store activity.",
    ],
  },
  {
    icon: Shield,
    title: "Your Rights",
    body: [
      "You may access, correct or request deletion of your account and energy data at any time from within the app or by contacting us.",
      "You can disconnect Anker or Octopus at any time; we will stop retrieving new data once access is revoked.",
      "You may withdraw consent for email alerts by disabling them in Settings.",
    ],
  },
  {
    icon: Mail,
    title: "Contact",
    body: [
      "If you have questions about this policy or how your data is handled, please contact the app owner through the app's Settings page.",
      "This policy may be updated from time to time; material changes will be reflected here with an updated date.",
    ],
  },
];

export default function PrivacyPolicy() {
  const lastUpdated = "8 August 2026";
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 pb-6">
        <div className="flex items-center gap-2 text-primary mb-3">
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Privacy Policy</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Your energy data, kept private
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          SolixX Energy Companion helps you monitor and optimise your Anker SOLIX X1
          home energy system alongside your Octopus Energy tariff. We take your privacy
          seriously and only collect what's needed to run the app for you.
        </p>
        <p className="text-xs text-muted-foreground mt-4">Last updated: {lastUpdated}</p>
      </section>

      {/* Sections */}
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

        {/* Footer */}
        <div className="pt-2 text-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} SolixX Energy Companion. This privacy policy is
            provided for users of the iOS app and the web application.
          </p>
        </div>
      </section>
    </div>
  );
}