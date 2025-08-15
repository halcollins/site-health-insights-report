import { Link } from "wouter";

const Header = () => {
  return (
    <header className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
      <div className="container mx-auto px-4 py-4 flex items-center justify-center">
        <Link href="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">W</span>
          </div>
          <div>
            <span className="text-foreground font-bold text-xl">Website</span>
            <span className="text-primary font-bold text-xl ml-1">Analyzer</span>
          </div>
        </Link>
      </div>
    </header>
  );
};

export default Header;
