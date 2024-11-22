import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import Home from "./pages/Home";
import Tutor from "./pages/Tutor";

function App() {
  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path={"/"} element={<Home />}></Route>
          <Route path={"/tutor"} element={<Tutor/>}></Route>
        </Routes>
      </BrowserRouter>
    </>
  );
}

export default App;
