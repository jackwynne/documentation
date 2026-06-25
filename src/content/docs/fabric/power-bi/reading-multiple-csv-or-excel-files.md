---
title: Reading Multiple CSV or Excel Files
description: Code for reading multiple CSV or Excel files in Power BI
lang: en
---

The examples below allow Power BI to read multiple csv or Excel files from a folder without having to use a seperate function to do so. Both use a parameter called "Folder Path" but this can be replaced with a path to any folder which contains multiple csv or Excel files. 

## Multiple CSV Files
After the conversion from binary to csv, expand the csv column which will automatically put in all the columns for you. The promote headers to get the header row as the column names. Note that you will need to filter out the header rows from the other files that have not been promoted and which will be in the data set that is created.

```powerquery
let
    Source = Folder.Files(#"Folder Path"),
    #"Filtered Hidden Files" = Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true),
    #"Removed Columns" = Table.RemoveColumns(#"Filtered Hidden Files",{"Extension", "Date accessed", "Date modified", "Date created", "Attributes", "Folder Path"}),
    #"Convert binary data to csv table" = Table.AddColumn(#"Removed Columns", "csv", each Csv.Document([Content],[Delimiter=",", Columns=4, Encoding=1252, QuoteStyle=QuoteStyle.None]))
in
    #"Convert binary data to csv table"
```
## Multiple Excel Files
Similar to the above except that it exands out the Excel data. Power BI's Excel reader picks up Sheets and Tables and so these are both displayed. Filter to what you need, remove un-needed columns (probably everything except the Data and maybe the file name) and then expand the Data column.
```powerquery
let
    Source = Folder.Files(#"Folder Path"),
    #"Filtered Hidden Files" = Table.SelectRows(Source, each [Attributes]?[Hidden]? <> true),
    #"Removed Columns" = Table.RemoveColumns(#"Filtered Hidden Files",{"Extension", "Date accessed", "Date modified", "Date created", "Attributes", "Folder Path"}),
    #"Convert binary data to Excel" = Table.AddColumn(#"Removed Columns", "Excel", each Excel.Workbook([Content])),
    #"Expanded Excel" = Table.ExpandTableColumn(#"Convert binary data to Excel", "Excel", {"Name", "Data", "Item", "Kind", "Hidden"}, {"Name.1", "Data", "Item", "Kind", "Hidden"})
in
    #"Expanded Excel"
```