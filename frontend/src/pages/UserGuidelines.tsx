import HomePageHeader from "@/components/HomePageHeader";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UserGuidelines() {
  return (
    <div className="pt-[70px] flex min-h-screen flex-col bg-background">
      <HomePageHeader />

      {/* Main Content */}
      <main className="container mx-auto flex-1 px-6 py-16">
        <div className="mx-auto max-w-4xl">
          {/* Hero Section */}
          <div className="mb-12 text-center space-y-4">
            <h1 className="text-5xl font-bold tracking-tight text-primary">
              User Guidelines
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Please review these guidelines before using Opterna
            </p>
          </div>

          {/* Guidelines Content */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="text-2xl">Acceptable Use Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-base leading-relaxed">
              <p>
                You agree not to use the Model or its Derivatives in any of the following ways:
              </p>

              {/* 1. Legal */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-primary">1. Legal</h3>
                <p>
                  In any way that violates any applicable national, federal, provincial, local or international law or regulation.
                </p>
              </div>

              {/* 2. Harm and Discrimination */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-primary">2. Harm and Discrimination</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>For the purpose of exploiting, harming or attempting to exploit or harm others in any way;</li>
                  <li>To generate or disseminate false information with the purpose of harming others;</li>
                  <li>To generate or disseminate personal identifiable information that can be used to harm an individual;</li>
                  <li>To defame, disparage or otherwise harass others;</li>
                  <li>To generate sexual content that is not educational in nature, especially pertaining to sexual violence or non-consensual intimate content;</li>
                  <li>To provide personal medical advice and medical results interpretation;</li>
                  <li>For any use intended to or which has the effect of harming individuals or groups based on online or offline social behavior or known or predicted personal or personality characteristics;</li>
                  <li>To exploit any of the vulnerabilities of a specific group of persons based on their age, social, physical or mental characteristics, in order to materially distort the behavior of a person belonging to that group in a manner that causes or is likely to cause that person or another person physical or psychological harm;</li>
                  <li>For any use intended to or which has the effect of discriminating against individuals or groups based on gender, gender identity and expression, sexual orientation, ability, physical appearance, body size, race, ethnicity, age, or religion.</li>
                </ul>
              </div>

              {/* 3. Disclosure and Transparency */}
              <div className="space-y-3">
                <h3 className="text-xl font-semibold text-primary">3. Disclosure and Transparency</h3>
                <ul className="list-disc list-inside space-y-2 ml-4">
                  <li>To generate or disseminate machine-generated information or content in any medium (e.g. school assignments, exams, or lecture materials) without expressly and intelligibly disclaiming that it is machine-generated;</li>
                  <li>To generate or disseminate information or content, in any context without expressly and intelligibly disclaiming that the text is machine generated;</li>
                  <li>To impersonate or attempt to impersonate human beings for purposes of deception;</li>
                  <li>For fully automated decision-making that adversely impacts an individual's legal rights or otherwise creates or modifies a binding, enforceable obligation.</li>
                </ul>
              </div>

              {/* Attribution */}
              <div className="pt-6 border-t">
                <p className="text-sm text-muted-foreground italic">
                  The User Guidelines is adapted from <a href="https://www.licenses.ai/ai-pubs-open-railm-vz1">AI Pubs Open RAIL-M License Use Restrictions</a> for non-commercial purposes.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}
