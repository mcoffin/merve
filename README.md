# merve

[`nerve`](https://github.com/airbnb/nerve) for [Mesos](http://mesos.apache.org)

# Example config

```json
{
    "harbaror": {
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
