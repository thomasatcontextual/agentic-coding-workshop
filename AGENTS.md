# AGENTS.md

Instructions and conventions for coding agents working on the agentic-coding-workshop.

## Development Setup

Install dependencies and start development:

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:3000`. Visit it to verify the app loads without errors.

## Project Structure

```
app/                    # Next.js App Router pages
  ├── layout.tsx        # Root layout with global styles
  └── page.tsx          # Home page component
components/ui/          # Reusable UI components (shadcn/ui pattern)
  ├── button.tsx
  ├── card.tsx
  └── input.tsx
lib/
  ├── db/index.ts       # SQLite database helpers (query, run, exec)
  └── utils.ts          # Utility functions (cn for className merging)
```

## Core Patterns

### Building UI Components

All UI components use the **shadcn/ui pattern**: Tailwind CSS with CVA for variants and `React.forwardRef` for ref support.

Example button component:
```tsx
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-foreground text-background hover:bg-foreground/90",
        outline: "border border-foreground bg-background hover:bg-foreground/10",
        destructive: "bg-red-500 text-white hover:bg-red-600",
      },
      size: {
        sm: "h-8 px-3 text-sm",
        md: "h-10 px-4 text-base",
        lg: "h-12 px-6 text-lg",
      },
    },
    defaultVariants: { variant: "default", size: "md" },
  }
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
```

Always use `cn()` for merging classes, not string concatenation.

### Creating Pages

Create new pages in the `app/` directory following Next.js App Router conventions:

```tsx
// app/todos/page.tsx
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TodosPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Todos</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Page content */}
      </CardContent>
    </Card>
  );
}
```

### Creating API Routes

Create API routes at `app/api/[route]/route.ts`. Use database helpers for SQLite:

```typescript
// app/api/items/route.ts
import { NextResponse } from "next/server";
import { query, run } from "@/lib/db";

export async function GET() {
  const items = query("SELECT * FROM items ORDER BY id DESC");
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const { name, description } = await request.json();
  const result = run(
    "INSERT INTO items (name, description) VALUES (?, ?)",
    [name, description]
  );
  return NextResponse.json({ id: result.lastInsertRowid, name, description });
}
```

### Database Operations

SQLite operations use four helper functions from `lib/db/index.ts`:

```typescript
import { query, queryOne, run, exec } from "@/lib/db";

// Create table
exec(`CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Select multiple rows
const items = query("SELECT * FROM items WHERE created_at > ?", [cutoffDate]);

// Select single row
const item = queryOne("SELECT * FROM items WHERE id = ?", [id]);

// Insert/Update/Delete
const result = run("INSERT INTO items (name) VALUES (?)", [name]);
console.log(result.lastInsertRowid);
```

## Code Style & Conventions

- **TypeScript**: All code is TypeScript. Use proper types for React components and database queries.
- **No ORM**: Raw SQL with parameterized queries. Use `?` placeholders to prevent SQL injection.
- **Component naming**: Export default from page files; named exports for reusable components.
- **Imports**: Use path aliases (`@/lib`, `@/components`) from `tsconfig.json`.
- **Styling**: Use Tailwind utility classes only. No CSS modules or inline styles.
- **Self-documenting code**: Prefer clear names over comments. Only comment why, not what.

## Testing & Validation

Before creating a commit:

```bash
npm run lint
```

This runs ESLint to catch type errors and style issues. Fix all linting errors.

Manually test any changes in the browser:
- Start dev server: `npm run dev`
- Open http://localhost:3000
- Test your feature in the browser
- Check browser console for errors

## Git Conventions

Commit messages follow conventional format:
- `feat(component): add new feature` - New feature
- `fix(page): correct bug behavior` - Bug fix
- `refactor(db): simplify query logic` - Code improvement
- `docs(readme): update instructions` - Documentation

Keep commits atomic: one logical change per commit. All changes must pass linting before commit.

## Common Tasks

**Add a new page:**
1. Create `app/[page-name]/page.tsx`
2. Add navigation link to home page if needed
3. Test at `http://localhost:3000/[page-name]`

**Add a database table:**
1. Call `exec()` in an API route or server action
2. Use parameterized queries with `query()` and `run()`
3. Define TypeScript type for each table

**Add a new UI component:**
1. Create `components/ui/[component].tsx`
2. Export with `React.forwardRef`
3. Use CVA for variant props if needed
4. Import and test in a page

## Debugging

- **Console errors**: Check browser DevTools console for runtime errors
- **Build errors**: `npm run build` shows TypeScript and bundling issues
- **Linting errors**: `npm run lint` shows code style problems
- **Database issues**: Check that `local.db` is writable and tables are created

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [TypeScript](https://www.typescriptlang.org/docs)
- [Lucide Icons](https://lucide.dev/icons)
- [CVA (class-variance-authority)](https://cva.style)
