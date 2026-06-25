---
title: Shape Maps
description: Frequently asked questions about Create T3 App
lang: en
---

## Custom Shape Files
See https://learn.microsoft.com/en-us/power-bi/visuals/desktop-shape-map#use-custom-maps
Need to convert the file to a TopoJson using https://mapshaper.org/

## Editing Custom Shape Maps
Once you have a shape file you can edit the shapes using https://mapshaper.org/.
To merge shapes select them and click split:
![image.png](../../../../assets/powerbi/merge-shapes.png)
Open the new layer and the console and use the "disolve" command to merge the shapes togther listing each of the fields on the shape that you want to keep on the combined shape.
Eg for the regions shape file
```
dissolve copy-fields="REGC2020_V","REGC2020_1","REGC2020_2","LAND_AREA_","AREA_SQ_KM","SHAPE_Leng","split_id
```
or for the TA shape file
```
dissolve copy-fields="TA2021_V1_","TA2021_V_1","TA2021_V_2","LAND_AREA_","AREA_SQ_KM","Shape_Leng","split_id"
```
Then merge the two layers back together using the merge command (if you havent included all of the fields you will need to use "force")
```
merge-layers target=1,2
```
Finally you can edit the attributes of the new shape if you need to set a new label for it.
![image.png](../../../../assets/powerbi/shape-attributes.png)
