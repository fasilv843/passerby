import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import RoomPage from './pages/RoomPage'
import Header from './components/Header'
// import { SocketProvider } from './context/SocketProvider'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<RoomPage />} />


        {/* <Route 
          path="/room" 
          element={
            <SocketProvider>
              <Room />
            </SocketProvider>
          } 
        /> */}

      </Routes>
    </BrowserRouter>
  )
}

export default App
