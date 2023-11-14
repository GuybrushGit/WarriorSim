Setting up development environment
==================================
This project uses gulp 3.9.1 to build, and currently does not work with Node 12+.

On windows you should install [nvm-windows](https://github.com/coreybutler/nvm-windows) and tell it to use Node 11.15.0.

Install webapp (first time):
```bash
git clone https://github.com/GuybrushGit/WarriorSim.git
cd WarriorSim
nvm install 11.15.0
nvm use 11.15.0
npm install
```

Run webapp (every time):
```bash
nvm use 11.15.0
npm run dev
```

After making code changes and testing that they work, make sure to rebuild the dist/ files:
```bash
npm run dist
git add .
git commit
```
