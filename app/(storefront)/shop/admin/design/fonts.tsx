// fonts.ts
import { FONT_LIBRARY } from "./registry";

export function FontLoader() {
  const families = FONT_LIBRARY.map(f => `family=${f.family.replace(/ /g, "+")}:wght@300;400;500;600;700`).join("&");
  return (
    <link
      rel="stylesheet"
      href={`https://fonts.googleapis.com/css2?${families}&display=swap`}
    />
  );
}