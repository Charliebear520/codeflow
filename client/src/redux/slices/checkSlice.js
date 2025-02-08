import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const checkFlowchart = createAsyncThunk(
  "check/checkFlowchart",
  async (imageData) => {
    const response = await fetch("http://localhost:3000/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ imageData }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `伺服器錯誤 (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "檢查失敗");
    }

    return data.result;
  }
);

const initialState = {
  result: null,
  isChecking: false,
  error: null,
};

const checkSlice = createSlice({
  name: "check",
  initialState,
  reducers: {
    resetCheck: (state) => {
      state.result = null;
      state.isChecking = false;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(checkFlowchart.pending, (state) => {
        state.isChecking = true;
        state.error = null;
      })
      .addCase(checkFlowchart.fulfilled, (state, action) => {
        state.isChecking = false;
        state.result = action.payload;
        state.error = null;
      })
      .addCase(checkFlowchart.rejected, (state, action) => {
        state.isChecking = false;
        state.error = action.error.message;
      });
  },
});

export const { resetCheck } = checkSlice.actions;
export default checkSlice.reducer;
