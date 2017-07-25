const ZNONODE = -101;

class ZookeeperError extends Error {
    constructor(rc, err) {
        super(`(${rc}) ${err}`);
        Error.captureStackTrace(this, this.constructor);
        this.name = this.constructor.name;
        this.err = err;
        this.rc = rc;
    }
}

function ensureBuffer(v) {
    if (v instanceof Buffer) {
        return v;
    } else {
        return Buffer.from(v);
    }
}

class PromiseZooKeeper {
    constructor(client) {
        this.client = client;
    }

    mkdirp(path) {
        return new Promise((resolve, reject) => {
            this.client.mkdirp(path, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(path);
                }
            });
        });
    }

    createOrUpdate(path, newData, flags) {
        return new Promise((resolve, reject) => {
            this.client.a_get(path, false, (rc, err, stat, currentData) => {
                if (rc != 0) {
                    reject(new ZookeeperError(rc, err));
                } else {
                    resolve({
                        stat: stat,
                        data: currentData
                    });
                }
            });
        })
            .catch(e => {
                if (e instanceof ZookeeperError && e.rc === ZNONODE) {
                    return {
                        stat: null,
                        data: null
                    };
                } else {
                    throw e;
                }
            })
            .then(({ stat, data }) => {
                if (!stat) {
                    return new Promise((resolve, reject) => {
                        this.client.a_create(path, newData, flags, (rc, err, path) => {
                            if (rc != 0) {
                                reject(new ZookeeperError(rc, err));
                            } else {
                                resolve(path);
                            }
                        });
                    });
                } else {
                    if (ensureBuffer(newData).equals(data)) {
                        return stat;
                    } else {
                        return new Promise((resolve, reject) => {
                            this.client.a_set(path, newData, stat.version, (rc, err, stat) => {
                                if (rc != 0) {
                                    reject(new ZookeeperError(rc, err));
                                } else {
                                    resolve(stat);
                                }
                            });
                        });
                    }
                }
            });
    }

    close() {
        return this.client.close();
    }
}

exports.PromiseZooKeeper = PromiseZooKeeper;
exports.ZookeeperError = ZookeeperError;
