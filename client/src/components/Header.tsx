
const Header = () => {
  return (
    <header className="w-full border-b">
    <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded bg-brand" />
        <span className="text-xl font-semibold">Passerby</span>
      </div>
      <nav className="text-sm text-gray-600 hidden sm:block">
        <span>Talk to random strangers instantly</span>
      </nav>
    </div>
  </header>
  )
}

export default Header
