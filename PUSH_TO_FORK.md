# Push this repo to your GitHub fork

The current `origin` points to the **upstream** repo:  
`https://github.com/kevinsuh/agentic-coding-workshop.git`  
You cannot push to it unless you are a collaborator.

## Option A: You haven’t forked yet

1. **Create a fork on GitHub**
   - Open: https://github.com/kevinsuh/agentic-coding-workshop
   - Click **Fork** (top right) and create the fork under your account.

2. **Add your fork as a remote and push**
   - Replace `YOUR_GITHUB_USERNAME` with your GitHub username:
   ```bash
   git remote add fork https://github.com/YOUR_GITHUB_USERNAME/agentic-coding-workshop.git
   git push fork main
   ```

3. **(Optional)** Rename remotes so your fork is the default:
   ```bash
   git remote rename origin upstream
   git remote rename fork origin
   ```
   Then future pushes: `git push origin main`.

## Option B: You already have a fork

If your fork is already at `https://github.com/YOUR_GITHUB_USERNAME/agentic-coding-workshop`:

```bash
git remote add fork https://github.com/YOUR_GITHUB_USERNAME/agentic-coding-workshop.git
git push fork main
```

## Optional: keep upstream for pulls

To pull updates from the original repo later:

```bash
git remote add upstream https://github.com/kevinsuh/agentic-coding-workshop.git   # if not already added
git fetch upstream
git merge upstream/main
```
