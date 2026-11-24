const signIn = document.querySelector("[data-manager-sign-in]");
const status = document.querySelector("[data-manager-sign-in-status]");

async function configurePrivateManager() {
  try {
    const response = await fetch("../data/manager-app.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Manager configuration is unavailable.");
    const config = await response.json();
    const url = String(config.url || "");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) throw new Error("Secure manager deployment is not configured yet.");
    signIn.href = url;
    signIn.removeAttribute("aria-disabled");
    status.textContent = "Secure manager is ready.";
  } catch (error) {
    console.warn(error);
    signIn.removeAttribute("href");
    signIn.setAttribute("aria-disabled", "true");
    status.textContent = "Manager sign-in is being configured. The guest Wine and Whiskey menus are unaffected.";
  }
}

signIn.addEventListener("click", (event) => {
  if (signIn.getAttribute("aria-disabled") === "true") event.preventDefault();
});

configurePrivateManager();
