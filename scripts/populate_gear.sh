jsonDataFile="./js/data/gear.js"
cppDataTempl="./cpp/items.cpp.template"
cppDataFile="./cpp/items.cpp"

cp -v ${cppDataTempl} ${cppDataFile}

function populate_gear () {
  gearJson=$(node -e "eval(fs.readFileSync('${jsonDataFile}')+''); console.log('%j', gear)")
  itemTypes=$(jq -r 'to_entries[] | .key' <<< "$gearJson")

  for itemType in ${itemTypes}; do
    echo "$itemType Items:"
    readarray -t ids < <(jq ".${itemType} | .[].id" <<< $gearJson); # build list of all IDs
    
    for id in ${ids[@]}; do
      # if ! grep -q ${id} ${cppDataFile}; then # for all items not yet processed
        generateCppSyntax;
        echo $cppLine;
        # add item to top of c++ array
        sed -i -z -- "s@item_${itemType}\[] =\n{\n@item_${itemType}[] =\n{\n  ${cppLine}\n@" ${cppDataFile}; # using @ as delimiter to avoid conflict with c++ // comment syntax
      # fi;
    done;
  done;
}

function generateCppSyntax () {
  # Initialize item stats to 0
  declare -A itemStats
  for stat in id sta str agi ap crit hit ac defense dodge parry skill type procchance ppm procextra procspell magicdmg physdmg binaryspell procgcd coeff Mainhand; do
    itemStats[$stat]=0
  done
    
  # Set stats where they exist
  while IFS="=" read -r stat value
  do
      itemStats[$stat]="$value"
  done < <(jq -r ".${itemType}[] | select(.id==${id}) | to_entries | map(\"\(.key)=\(.value)\") | .[]" <<< "$gearJson")
 
  # Generate c++ syntax from item stats array
  # Example of end result:
  # { 81260, { 6, 0, 0, 0, 1, 0, 0, 0, 0, 0, { 0, 0, 0, 0, 0, 0 } }, { 3, 79, 147, 2.4 }, { 0, 0, 0, 0, 0, 0, 0, 0, nullptr } }, } // Lavashard Axe
  cppLine="{ "
  cppLine+="${itemStats["id"]}, { "
  cppLine+="${itemStats["sta"]}, "
  cppLine+="${itemStats["str"]}, "
  cppLine+="${itemStats["agi"]}, "
  cppLine+="${itemStats["ap"]}, "
  cppLine+="${itemStats["crit"]}, "
  cppLine+="${itemStats["hit"]}, "
  cppLine+="${itemStats["ac"]}, "
  cppLine+="${itemStats["defense"]}, "
  cppLine+="${itemStats["dodge"]}, "
  cppLine+="${itemStats["parry"]}, "
  case ${itemStats["type"]} in # weapon, or armor w/ wep skill
    Mace)    cppLine+="{ ${itemStats["skill"]}, 0, 0, 0, 0, 0 }"; wepType=0 ;;
    Sword)   cppLine+="{ 0, ${itemStats["skill"]}, 0, 0, 0, 0 }"; wepType=1 ;;
    Dagger)  cppLine+="{ 0, 0, ${itemStats["skill"]}, 0, 0, 0 }"; wepType=2 ;;
    Axe)     cppLine+="{ 0, 0, 0, ${itemStats["skill"]}, 0, 0 }"; wepType=3 ;;
    Fist)    cppLine+="{ 0, 0, 0, 0, ${itemStats["skill"]}, 0 }"; wepType=4 ;;
    Polearm) cppLine+="{ 0, 0, 0, 0, 0, ${itemStats["skill"]} }"; wepType=5 ;;
    *)       cppLine+="{ 0, 0, 0, 0, 0, 0 }" ;; # armor, no skill
  esac
  
  cppLine+=" }, { " # end +stats and skills, begin wep stats
  
  if [[ ${itemStats["speed"]} ]]; then # weapon
    cppLine+="${wepType}, "
    cppLine+="${itemStats["mindmg"]}, "
    cppLine+="${itemStats["maxdmg"]}, "
    cppLine+="${itemStats["speed"]}"
  else # aromor
    cppLine+="-1, 0, 0, 0.0"
  fi
  
  cppLine+=" }, { " # end wep stats, begin proc info
  
  cppLine+="${itemStats["procchance"]}, "
  cppLine+="${itemStats["ppm"]}, "
  cppLine+="${itemStats["procextra"]}, "
  cppLine+="${itemStats["magicdmg"]}, "
  cppLine+="${itemStats["physdmg"]}, "
  cppLine+="${itemStats["binaryspell"]}, "
  cppLine+="${itemStats["procgcd"]}, "
  cppLine+="${itemStats["coeff"]}, "
  
  if [[ ! ${itemStats["procspell"]} == 0 ]]; then
    if [[ ! ${itemType} == "twohand" ]]; then # 1handers only
      if [[ ! ${itemStats["Mainhand"]} == 0 ]]; then
        cppLine+="addproc<${itemStats["procspell"]}>"   # mainhanders only
      elif [[ ${itemType} == "mainhand" ]]; then
        cppLine+="addproc<${itemStats["procspell"]}MH>" # 1hander in mainhand
      else
        cppLine+="addproc<${itemStats["procspell"]}OH>" # 1hander in offhand
      fi
    else
      cppLine+="addproc<${itemStats["procspell"]}>"
    fi
  else
    cppLine+="nullptr"
  fi
  
  cppLine+="} }, "

  # add the item's name as a c++ comment at the end of the line
  cppLine+="// ${itemStats["name"]}"
}

populate_gear;
