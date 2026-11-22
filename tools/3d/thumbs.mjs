// Фото товаров из 3D (вещь без тела, белая ткань, прозрачный фон) для каталога, корзины и карточек.
// Нужен запущенный tools/3d/serve.py public/3d/models. Затем: python3 tools/3d/thumbs_pack.py
//   node tools/3d/thumbs.mjs <tmp_dir>
import { execFileSync } from "node:child_process";
const tmp = process.argv[2];
const SHOTS = {
  anorak: "top_anorak&az=20", tshirt: "top_tshirt&az=20", joggers: "bottom_joggers&az=20", halat: "coat_halat&az=20",
  cap: "head_cap&az=35&elev=0.12", dokerka: "head_dokerka&az=35&elev=0.12", sabo: "feet_sabo&az=35&elev=0.35",
  lanyard: "acc_lanyard&az=0&elev=0.1", shopper: "acc_shopper&az=-25&elev=0.15",
};
for (const [slug, q] of Object.entries(SHOTS)) {
  const [item, ...rest] = q.split("&");
  const base = `g=f&nobody=1&transparent=1&fit=1&env=0.6&${rest.join("&")}`;
  execFileSync("node", ["tools/3d/shot.mjs", `${base}&items=${item}:FFFFFF`, `${tmp}/${slug}.png`, "640", "640"], { stdio: "inherit" });
  execFileSync("node", ["tools/3d/shot.mjs", `${base}&items=${item}:FFFFFF&hide=trim&flat=1`, `${tmp}/${slug}-mask.png`, "640", "640"], { stdio: "inherit" });
  console.log(slug);
}
