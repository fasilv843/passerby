import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Room from './pages/Room'
import Header from './components/Header'
// import { SocketProvider } from './context/SocketProvider'

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room" element={<Room />} />


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
