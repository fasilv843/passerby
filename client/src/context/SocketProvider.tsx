// import { io } from "socket.io-client";
// import { useEffect, useMemo, type ReactNode } from "react";
// import { SocketContext } from "./SocketContext";

// // Props type for provider
// interface SocketProviderProps {
//   children: ReactNode;
// }

// export const SocketProvider: React.FC<SocketProviderProps> = ({ children }) => {
//   const socket = useMemo(() => io("http://localhost:3000"), []);

//   // cleanup on unmount
//   useEffect(() => {
//     return () => {
//       socket.disconnect();
//     };
//   }, [socket]);

//   return (
//     <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
//   );
// };
