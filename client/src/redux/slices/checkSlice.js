import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";

export const checkFlowchart = createAsyncThunk(
  "check/checkFlowchart",
  async (payload) => {
    // 解構 payload 以獲取 imageData、question、stage
    const { imageData, question, stage } =
      typeof payload === "object" ? payload : { imageData: payload };

    // 從 localStorage 獲取當前問題（如果沒有直接提供）
    const currentQuestion =
      question || localStorage.getItem("currentFlowchartQuestion");

    const response = await fetch("/api/check", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageData,
        question: currentQuestion,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || `伺服器錯誤 (${response.status})`);
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || "檢查失敗");
    }

    return { result: data.result, stage: stage || 1 };
  }
);

const initialState = {
  // 針對三個階段分開保存回覆
  byStage: {
    1: null,
    2: null,
    3: null,
  },
  isChecking: false,
  error: null,
};

const checkSlice = createSlice({
  name: "check",
  initialState,
  reducers: {
    resetCheck: (state) => {
      state.byStage = { 1: null, 2: null, 3: null };
      state.isChecking = false;
      state.error = null;
    },
    resetStage: (state, action) => {
      const stage = action.payload;
      if (stage === 1 || stage === 2 || stage === 3) {
        state.byStage[stage] = null;
      }
    },
    setStageFeedback: (state, action) => {
      const { stage, feedback } = action.payload || {};
      if (stage === 1 || stage === 2 || stage === 3) {
        state.byStage[stage] = feedback || null;
      }
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
        const { result, stage } = action.payload || {};
        const key = stage === 2 || stage === 3 ? stage : 1;
        state.byStage[key] = result;
        state.error = null;
      })
      .addCase(checkFlowchart.rejected, (state, action) => {
        state.isChecking = false;
        state.error = action.error.message;
      });
  },
});

export const { resetCheck, resetStage, setStageFeedback } = checkSlice.actions;
export default checkSlice.reducer;
