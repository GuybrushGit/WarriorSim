const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { exec } = require('child_process');

function async_limit(func, limit) {
  const executing = [];
  return async function(...args) {
    while (executing.length >= limit) {
      await Promise.race(executing).catch(() => null);
    }
    const p = Promise.resolve().then(() => func(...args));
    const e = p.finally(() => executing.splice(executing.indexOf(e), 1));
    executing.push(e);
    return p;
  };
}
const execute = async_limit((cmd, cb) => new Promise((resolve, reject) => {
  if (cb) cb();
  exec(cmd, function(err, stdout, stderr) {
    if (err) {
      reject(err);
    } else {
      resolve({stdout, stderr});
    }
  });
}), 6);

function isDir(p) {
  try {
    let stat = fs.statSync(p);
    return stat.isDirectory() ? 1 : -1;
  } catch (e) {
    return 0;
  }
}

function mkdirsSync(p) {
  const status = isDir(p);
  if (status === 1) {
    return;
  } else if (status === -1) {
    throw new Error(`path ${p} is not a directory`);
  } else {
    const par = path.dirname(p);
    if (par === p) {
      return; // how?
    }
    mkdirsSync(par);
    fs.mkdirSync(p);
  }
}

async function run_build(flags, oname, dirs) {
  const out_dir = `./emcc/${oname}`;

  let rebuild = true;
  if (fs.existsSync(`${out_dir}/args.txt`)) {
    if (fs.readFileSync(`${out_dir}/args.txt`, 'utf8') === flags) {
      rebuild = false;
    }
  }

  const link_list = [];
  let firstFile = true;
  let maxTime = null;

  let fileTime = new Map();
  function file_time(name) {
    if (fileTime.has(name)) {
      return fileTime.get(name);
    }
    const time = (async () => {
      const data = await fsp.readFile(name, 'utf8');
      const reg = /^\s*#include "(.*)"/mg;
      let m;
      const includes = [];
      const dir = path.dirname(name);
      while (m = reg.exec(data)) {
        includes.push(path.join(dir, m[1]));
      }
      const incl = includes.map(n => file_time(n));
      const times = await Promise.all(incl);
      const time = times.reduce((res, t) => (res > t ? res : t), (await fsp.stat(name)).mtime);
      return time;
    })();
    fileTime.set(name, time);
    return time;
  }

  async function handle_file(name) {
    const statSrc = await fsp.stat(name);
    if (statSrc.isDirectory()) {
      const list = await fsp.readdir(name);
      await Promise.all(list.map(fn => handle_file(`${name}/${fn}`)));
    } else if (name.match(/\.(?:c|cpp|cc)$/i)) {
      const out = `${out_dir}/${name}.bc`;
      const srcTime = await file_time(name);
      let statDst = null;
      if (fs.existsSync(out)) {
        statDst = await fsp.stat(out);
      } else {
        mkdirsSync(path.dirname(out));
      }

      if (rebuild || !statDst || srcTime > statDst.mtime) {
        if (firstFile) {
          console.log('Compiling...');
          firstFile = false;
        }
        const cmd = `emcc ${name} -o ${out} ${name.match(/\.(?:cpp|cc)$/i) ? "--std=c++17 " : ""} -c -Wno-logical-op-parentheses ${flags} -I.`;
        try {
          const {stderr} = await execute(cmd, () => console.log(`  ${name}`));
          if (stderr) {
            console.error(stderr);
          }
        } catch (e) {
          if (fs.existsSync(out)) {
            await fsp.unlink(out);
          }
          throw e;
        }
      }

      if (!maxTime || srcTime > maxTime) {
        maxTime = srcTime;
      }

      link_list.push(out);
    }
  }

  await Promise.all(dirs.map(dir => handle_file(dir)));
  mkdirsSync(out_dir);
  fs.writeFileSync(`${out_dir}/args.txt`, flags);

  let wasmTime = null;
  if (fs.existsSync(oname + '.wasm')) {
    wasmtime = fs.statSync(oname + '.wasm').mtime;
  }

  if (!rebuild && (!maxTime || (wasmTime && maxTime <= wasmTime))) {
    console.log('Everything is up to date');
    return;
  }

  console.log(`Linking ${oname}`);

  const cmd = `emcc ${link_list.join(" ")} -o ${oname}.js -s EXPORT_NAME="${oname}" ${flags} -s WASM=1 -s MODULARIZE=1 -s NO_FILESYSTEM=1 --post-js ./module-post.js -s TOTAL_MEMORY=16777216 -s DISABLE_EXCEPTION_CATCHING=0`;
  const {stderr} = await execute(cmd);
  if (stderr) {
    console.error(stderr);
  }
}

run_build('-O3 -g -DUSE_EMSCRIPTEN', 'WarriorSim', ['cpp']).catch(e => console.error(e.message));
