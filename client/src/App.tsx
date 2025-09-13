import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RoomPage from './pages/RoomPage'
import Header from './components/Header'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<RoomPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
