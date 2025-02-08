import { configureStore } from "@reduxjs/toolkit";
import checkReducer from "./slices/checkSlice";

export const store = configureStore({
  reducer: {
    check: checkReducer,
    // ... 其他 reducers
  },
});
