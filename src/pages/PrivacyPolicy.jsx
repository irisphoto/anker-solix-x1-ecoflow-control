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
      "Connection credentials you enter: your Anker SOLIX email, password and country, and your Octopus Energy API key and account number. These are stored against your own account so the app can retrieve your data on your behalf.",
      "Energy device data: telemetry from your Anker SOLIX X1 system, including battery level, solar generation, home usage, grid flow and EV charger power.",
      "Tariff and consumption data: electricity tariff rates and half-hourly consumption retrieved from your Octopus Energy account.",
    ],
  },
  {
    icon: Server,
    title: "How We Use Your Information",
    body: [
      "To display real-time energy generation, storage and consumption on your dashboard.",
      "To calculate savings and visualize trends over time.",
      "To run tariff-aware optimisation, automation rules and AI-generated charging plans for your battery and EV charger.",
      "To send you optional email alerts about your energy savings, to your registered email address.",
      "We never sell your data or share it with advertisers.",
    ],
  },
  {
    icon: Lock,
    title: "Data Storage & Security",
    body: [
      "Your data is stored in the secure Base44 cloud platform, hosted on managed infrastructure with encryption in transit.",
      "Each user's devices, readings, tariffs and schedules are isolated to that account. Access is enforced at the database level — you can only ever see or control your own energy system, never anyone else's.",
      "Your Anker password and Octopus API key are stored against your account and used only to authenticate with Anker and Octopus on your behalf. Because Anker does not offer a public OAuth login, your Anker password is stored as you provide it; keep your account secure.",
      "Credentials are never exposed to other users and are never used to access any account but your own.",
    ],
  },
  {
    icon: ExternalLink,
    title: "Third-Party Services",
    body: [
      "Anker SOLIX cloud API — to read and control your energy storage system on your behalf. This is an unofficial, community-reverse-engineered API and may change or stop working without notice.",
      "Octopus Energy API — to retrieve tariff rates and smart-meter consumption from your account.",
      "OpenAI / Google Gemini — to generate AI-driven charging recommendations based on your usage and tariff (no personal data is sold to these providers).",
      "Apple App Store — used to deliver the app to your device. Apple's privacy policy applies to App Store activity.",
    ],
  },
  {
    icon: Shield,
    title: "Your Rights",
    body: [
      "You may access, correct or request deletion of your account and energy data at any time from within the app or by contacting us.",
      "You can remove your Anker or Octopus credentials at any time in Settings; we will stop retrieving new data once access is revoked.",
      "You may withdraw consent for email alerts by disabling them in Settings.",
      "You are responsible for keeping your Anker and Octopus credentials secure and for any actions taken through the app using your accounts.",
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
          <Shield className="w-5 h-5" />
          <span className="text-sm font-semibold uppercase tracking-wide">Privacy Policy</span>
        </div>
        <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Your energy data, kept private
        </h1>
        <p className="text-muted-foreground leading-relaxed">
          SolixX Energy Companion helps you monitor and optimise your Anker SOLIX X1
          home energy system alongside your Octopus Energy tariff. Each user connects their
          own accounts and only ever sees their own data. We take your privacy seriously and
          only collect what's needed to run the app for you.
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
            © {new Date().getFullYear()} SolixX Energy Companion. This privacy policy is
            provided for users of the iOS app and the web application. See our{" "}
            <Link to="/terms" className="text-primary underline-offset-4 hover:underline">Terms of Service</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}