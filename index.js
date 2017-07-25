const _ = require('lodash');
const Lazy = require('lazy.js');
const fs = require('fs');
const { URL } = require('url');
const ZooKeeper = require('zookeeper');
const { PromiseZooKeeper } = require('./lib/zookeeper');

const args = require('minimist')(process.argv);

const zk = new ZooKeeper({
    connect: args.zk,
    timeout: 5000
});

const masterUrl = new URL(args.master);
const http = require(masterUrl.protocol.replace(':', ''));

class HttpResponse {
    constructor(response, body) {
        this.statusCode = response.statusCode;
        this.headers = response.headers;
        this.body = body;
    }

    get isSuccess() {
        if (this.statusCode >= 200 && this.statusCode < 300) {
            return true;
        } else {
            return false;
        }
    }

    checkStatusCode() {
        if (this.isSuccess) {
            return this;
        } else {
            throw new Error(`Bad HTTP status code: ${this.statusCode}`);
        }
    }
}

function getMatches(config, tasks) {
    let matches = {};
    Lazy(config).pairs().map(([ name, serviceConfig ]) => {
        const relevantTasks = Lazy(tasks).filter((task) => {
            return Lazy(serviceConfig.matches)
                .map(({ query, pattern }) => {
                    const exp = new RegExp(pattern);
                    return exp.test(_.get(task, query));
                })
                .reduce((a, b) => a && b);
        });
        const nodes = relevantTasks.map((task) => {
            const host = _.get(task, 'statuses[0].container_status.network_infos[0].ip_addresses[0].ip_address');
            return {
                name: task.id,
                host: host,
                port: serviceConfig.port,
                weight: 1
            };
        }).toArray();
        return [ name, nodes ];
    }).each(([ name, nodes ]) => matches[name] = nodes);
    return matches;
}

var globalConfig = undefined;
const readConfig = new Promise((resolve, reject) => {
    fs.readFile(args.config, 'utf8', (err, data) => {
        if (err) {
            return reject(err);
        }
        return resolve(data);
    });
})
    .then(JSON.parse)
    .then((cfg) => {
        globalConfig = cfg;
        return cfg;
    });

const tasks = new Promise((resolve, reject) => {
    const requestOptions = {
        protocol: masterUrl.protocol,
        host: masterUrl.hostname,
        port: masterUrl.port,
        path: '/master/tasks',
        auth: `${args['principal']}:${args['secret']}`
    };
    const req = http.get(requestOptions, (res) => {
        body = '';
        res.on('error', reject);
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
            body = body + chunk;
        });
        res.on('end', () => resolve(
            new HttpResponse(res, body)
        ));
    });
    req.on('error', reject);
    req.end();
})
    .then((res) => res.checkStatusCode())
    .then(({ body }) => JSON.parse(body))
    .then((body) => readConfig.then(() => body))
    .then(({ tasks }) => getMatches(globalConfig, tasks))
    .then((services) => {
        const clientPromise = new Promise((resolve, reject) => {
            zk.connect((err, client) => {
                if (err) {
                    return reject(err);
                } else {
                    return resolve(client);
                }
            });
        })
            .then(client => new PromiseZooKeeper(client));
        const zkPromises = Lazy(services).pairs().map(([ service, nodes ]) => {
            return clientPromise
                .then(client => {
                    return client.mkdirp(`/nerve/${service}`)
                        .then(() => {
                            const nodePromises = Lazy(nodes).map(node => {
                                return client.createOrUpdate(`/nerve/${service}/${node.name}`, JSON.stringify(node));
                            }).toArray();
                            return Promise.all(nodePromises);
                        });
                })
        }).toArray();
        return Promise.all(zkPromises)
            .then(() => clientPromise)
            .then((client) => client.close());
    })
    .then(() => console.log("success"))
    .catch((e) => {
        if (e instanceof Error) {
            console.error(e.stack);
        } else {
            console.error(JSON.stringify(e));
        }
        process.exit(1);
    });
