import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Header from "./components/Header";
import Loading from "./components/Loading";
import Home from "./pages/Home";
import RoomPage from "./pages/RoomPage";

// Group rooms pull in mediasoup-client; load it only when someone opens a group page.
const GroupPage = lazy(() => import("./pages/GroupPage"));

function App() {
  return (
    <BrowserRouter>
      <Header />
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/room" element={<RoomPage />} />
          <Route path="/group" element={<GroupPage />} />
          <Route path="/group/:roomId" element={<GroupPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default App;
