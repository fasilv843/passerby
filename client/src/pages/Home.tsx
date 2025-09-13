import { Link } from 'react-router-dom'
import Footer from '../components/Footer'

export default function Home() {

  return (
    <div className="min-h-screen flex flex-col">

      <main className="flex-1">
        <section className="bg-gradient-to-b from-brand/10 to-transparent">
          <div className="max-w-6xl mx-auto px-4 py-16 grid md:grid-cols-2 gap-10 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Meet a stranger. Have a conversation.
              </h1>
              <p className="text-gray-600 mb-8">
                Passerby connects you with people across the world. No sign up required.
              </p>
              <Link to="/room" className="btn btn-primary">
                <span className="icon">forum</span>
                Talk with a Stranger
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="h-40 md:h-52 rounded-lg bg-white shadow border flex items-center justify-center">
                <span className="text-gray-500">Ad space</span>
              </div>
              <div className="h-40 md:h-52 rounded-lg bg-white shadow border flex items-center justify-center">
                <span className="text-gray-500">Banner</span>
              </div>
              <div className="h-40 md:h-52 rounded-lg bg-white shadow border flex items-center justify-center md:col-span-2">
                <span className="text-gray-500">Promo</span>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}


