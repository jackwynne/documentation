---
title: New Project Code
description: Code to import key functions and UDFs to a new project
lang: en
---

## New Spark Project Code

### All the imports and UDFs together:

```python
from pyspark.sql.functions import sum, max, min, first, when, col, lag, lead, count, lit, month, year, to_date, concat_ws, last_day, row_number, desc_nulls_last, substring_index
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, DateType, TimestampType
import pandas as pd
import re

def renameAllColumns(df):
    oldColumnNames = df.columns
    newColumnNames = list(map(lambda name: name[0].casefold() + re.sub('[^a-zA-Z0-9\n\.]', '', name[1:]), oldColumnNames))
    dfNew = df

    for i in range(0, len(oldColumnNames)):
        dfNew = dfNew.withColumnRenamed(oldColumnNames[i], newColumnNames[i])

    return dfNew
```

### Just imports

```python
from pyspark.sql.functions import sum, max, min, first, when, col, lag, lead, count, lit, month, year, to_date, concat_ws, last_day, row_number, desc_nulls_last, substring_index
from pyspark.sql.window import Window
from pyspark.sql.types import StringType, DateType, TimestampType
import pandas as pd
import re
```

### Rename all columns with no special characters

```python
import re

def renameAllColumns(df):
    oldColumnNames = df.columns
    newColumnNames = list(map(lambda name: name[0].casefold() + re.sub('[^a-zA-Z0-9\n\.]', '', name[1:]), oldColumnNames))
    dfNew = df

    for i in range(0, len(oldColumnNames)):
        dfNew = dfNew.withColumnRenamed(oldColumnNames[i], newColumnNames[i])

    return dfNew
```
