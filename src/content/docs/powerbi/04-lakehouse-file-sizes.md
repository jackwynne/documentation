---
title: Get Lakehouse File Sizes
description: Python code to get the size of each directory in a Fabric Lakehouse
lang: en
---

## Get File Size

### Setup Code
```python
import os
import pandas as pd
from multiprocessing import Pool, cpu_count


def get_size_of_folder(folder_path):
    """
    fabric.guru  |  08-09-2023
    Calculate the total size of all files in the given folder.

    Args:
    - folder_path (str): Path to the folder.

    Returns:
    - tuple: (folder_path, size in MB)
    """
    total_size = sum(
        os.path.getsize(os.path.join(dirpath, f)) 
        for dirpath, _, filenames in os.walk(folder_path) 
        for f in filenames
    )

    size_in_mb = total_size / (1024 * 1024)
    return folder_path, size_in_mb


def get_folder_sizes(base_path):
    """
    fabric.guru  |  08-09-2023
    Get the sizes of all folders in the given base path.

    Args:
    - base_path (str): Base directory path.

    Returns:
    - DataFrame: DataFrame with columns 'Folder' and 'Size (MB)'.
    """
    folders = [
        os.path.join(base_path, folder) 
        for folder in os.listdir(base_path) 
        if os.path.isdir(os.path.join(base_path, folder))
    ]

    with Pool(cpu_count()) as p:
        sizes = p.map(get_size_of_folder, folders)

    df = pd.DataFrame(sizes, columns=['Folder', 'Size (MB)'])
    return df
```
### Run Code
```python
files = get_folder_sizes("/lakehouse/default/Files")
display(files)
tables = get_folder_sizes("/lakehouse/default/Tables")
display(tables)
```
