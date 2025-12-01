import { Link } from "react-router";

export default function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-6 py-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} Opterna. All rights reserved.
          </div>
          <div className="flex gap-6">
            <Link 
              to="/guidelines" 
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              User Guidelines
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
