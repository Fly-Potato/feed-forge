import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { invoke } from "@tauri-apps/api/core";
import { useState, type FormEvent } from "react";

function App() {
  const [name, setName] = useState("");
  const [message, setMessage] = useState(
    "Enter a name to verify the desktop bridge.",
  );

  async function greet(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const greeting = await invoke<string>("greet", { name });
      setMessage(greeting);
    } catch {
      setMessage("Could not reach the Feed Forge desktop runtime.");
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-6">
      <section
        className="w-full max-w-xl rounded-xl border border-border border-t-4 border-t-primary bg-card p-8 text-card-foreground shadow-xl sm:p-11"
        aria-labelledby="welcome-title"
      >
        <p className="mb-3 font-mono text-xs font-semibold uppercase tracking-widest text-primary">
          Desktop skeleton · Tauri v2
        </p>
        <h1
          id="welcome-title"
          className="text-4xl font-bold tracking-tight sm:text-5xl"
        >
          Welcome to Feed Forge
        </h1>
        <p className="mt-4 max-w-lg text-muted-foreground">
          React renders this interface. Rust answers through one minimal IPC
          command.
        </p>

        <form className="mt-8" onSubmit={greet}>
          <Field>
            <FieldLabel htmlFor="greet-input">Name</FieldLabel>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <Input
                id="greet-input"
                className="h-11"
                onChange={(event) => setName(event.currentTarget.value)}
                placeholder="Enter a name"
                value={name}
              />
              <Button className="h-11 px-5" type="submit">
                Send greeting
              </Button>
            </div>
          </Field>
        </form>

        <p
          className="mt-6 min-h-6 border-t border-border pt-5 text-sm text-muted-foreground"
          role="status"
        >
          {message}
        </p>
      </section>
    </main>
  );
}

export default App;
