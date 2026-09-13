import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { createAppQueryClient } from "@/lib/query/client";
import { ReaderPage } from "@/modules/reader/pages/ReaderPage";

function App() {
  const [queryClient] = useState(createAppQueryClient);
  return <QueryClientProvider client={queryClient}><ReaderPage /></QueryClientProvider>;
}

export default App;
