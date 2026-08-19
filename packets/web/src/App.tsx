import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Home } from "./pages/Home";
import { Create } from "./pages/Create";
import { PacketPage } from "./pages/PacketPage";
import { History } from "./pages/History";
import { EnvelopeLab } from "./pages/EnvelopeLab";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="create" element={<Create />} />
        <Route path="p/:address" element={<PacketPage />} />
        <Route path="history" element={<History />} />
        <Route path="envelopes" element={<EnvelopeLab />} />
      </Route>
    </Routes>
  );
}
