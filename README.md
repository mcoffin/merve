# merve

[`nerve`](https://github.com/airbnb/nerve) for [Mesos](http://mesos.apache.org).

Running `merve` will add zookeeper entries in [`nerve`](https://github.com/airbnb/nerve)'s style for service discovery purposes based on the task list from a mesos master. It is recommended to run it periodically, via something like [Chronos](https://mesos.github.io/chronos).

# Command line options

| Option | Description | Example |
| ------ | ----------- | ------- |
| `--zk` | List of zookeeper hosts (comma separated) | `zk1:2181,zk2:2181` |
| `--master` | URL of the mesos master | `https://master.mesos.local:5050` |
| `--config` | Path to the config file | `/path/to/config.json` |
| `--principal` | HTTP basic-auth principal for communicating with the mesos master | `someuser` |
| `--secret` | HTTP basic-auth password for communicating with the mesos master | `somepass` |

# Example config

```json
{
    "harbaror": {
        "port": 8080,
        "matches": [
            {
                "query": "name",
                "pattern": "^.*harbaror.*$"
            },
            {
                "query": "state",
                "pattern": "^TASK_RUNNING$"
            }
        ]
    }
}
```
