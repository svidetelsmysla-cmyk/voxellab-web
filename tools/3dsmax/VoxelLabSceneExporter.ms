/* VoxelLab Scene Exporter V2 — public engineering interchange.
   Exports selected objects or the full scene as *.voxellab.scene.json.
   Meshes remain positive rigid identities; this script issues no physics verdict. */

global VoxelLabSceneExporter

fn vlEscape value = (
  local text = value as string
  text = substituteString text "\\" "\\\\"
  text = substituteString text "\"" "\\\""
  text
)

fn vlProp node key fallback = (
  local value = getUserProp node key
  if value == undefined or value == "" then fallback else value
)

fn vlBool node key fallback = (
  local value = toLower (vlProp node key (fallback as string))
  value == "true" or value == "1" or value == "yes"
)

fn vlVec value fallback = (
  local tokens = filterString value ", ;[]"
  if tokens.count == 3 then [tokens[1] as float, tokens[2] as float, tokens[3] as float] else fallback
)

fn vlVecJson value = formattedPrint value format:"[%.9g,%.9g,%.9g]"
fn vlQuatJson value = formattedPrint value format:"[%.9g,%.9g,%.9g,%.9g]"

fn vlNodeJson node index = (
  local role = vlProp node "vl_role" "IMPORTED_BODY"
  local amount = (vlProp node "vl_amount" "1.0") as float
  local density = (vlProp node "vl_density" "1.0") as float
  local kv = (vlProp node "vl_kv" "1.0") as float
  local locked = vlBool node "vl_locked" false
  local movableT = vlBool node "vl_movable_translation" (not locked)
  local movableR = vlBool node "vl_movable_rotation" (not locked)
  local velocity = vlVec (vlProp node "vl_initial_velocity" "0,0,0") [0,0,0]
  local packing = toUpper (vlProp node "vl_packing" "IMPORTED_POINTS")
  local computeResolution = (vlProp node "vl_compute_resolution" "1") as integer
  local displayResolution = (vlProp node "vl_display_resolution" (computeResolution as string)) as integer
  local bounds = node.max - node.min
  local radius = 0.5 * length bounds
  local parentId = if node.parent == undefined then "null" else ("\"max-" + (node.parent.handle as string) + "\"")
  local groupName = if isGroupMember node then node.parent.name else "MAX_SCENE"
  local q = node.rotation as quat
  "{" +
  "\"object_id\":\"max-" + (node.handle as string) + "\"," +
  "\"group_id\":\"" + vlEscape groupName + "\"," +
  "\"parent_id\":" + parentId + "," +
  "\"display_name\":\"" + vlEscape node.name + "\"," +
  "\"body_role\":\"" + vlEscape role + "\"," +
  "\"representation_mode\":\"RIGID_VOLUME\"," +
  "\"transform\":{\"position\":" + vlVecJson node.position + ",\"rotation\":" + vlQuatJson [q.x,q.y,q.z,q.w] + ",\"scale\":" + vlVecJson node.scale + "}," +
  "\"geometry_type\":\"IMPORTED_MESH\",\"outer_radius\":" + (radius as string) + "," +
  "\"amount\":" + (amount as string) + ",\"density\":" + (density as string) + ",\"k_v\":" + (kv as string) + "," +
  "\"world_locked\":" + (locked as string) + ",\"movable_translation\":" + (movableT as string) + ",\"movable_rotation\":" + (movableR as string) + "," +
  "\"initial_velocity\":" + vlVecJson velocity + ",\"initial_angular_velocity\":[0,0,0],\"velocity\":" + vlVecJson velocity + ",\"angular_velocity\":[0,0,0]," +
  "\"fixed_far\":false,\"visible\":true,\"kou_tier\":null,\"kou_role\":null," +
  "\"packing\":{\"mode\":\"" + packing + "\",\"level\":\"P4\",\"custom_count\":" + (computeResolution as string) + ",\"display_count\":" + (displayResolution as string) + ",\"compute_count\":" + (computeResolution as string) + ",\"boundary_policy\":\"IMPORTED_POINTS\"}," +
  "\"voxel_level\":\"V4\",\"voxel_elements\":[{\"local_position\":[0,0,0],\"amount\":" + (amount as string) + ",\"volume\":" + ((amount/density) as string) + "}]," +
  "\"provenance\":{\"source\":\"VoxelLabSceneExporter.ms\",\"producer_commit\":\"3DSMAX_LOCAL_EXPORT\",\"claim_ceiling\":\"PREVIEW_IMPORT_ONLY\"}" +
  "}"
)

fn vlExport nodes outputPath = (
  local stream = createFile outputPath
  format "{\n\"scene_version\":\"2.0\",\n\"scene_id\":\"S17_3DSMAX_IMPORTED\",\n\"scene_class\":\"DIAGNOSTIC\",\n\"category\":\"3ds Max import\",\n\"display_name\":\"3ds Max exported scene\",\n\"description\":\"World-transform and hierarchy fixture from VoxelLabSceneExporter.ms\",\n\"mobility_summary\":\"mixed explicit lock states\",\n\"does_not_claim\":\"scientific authority\",\n\"coefficient_c\":0.22,\n\"objects\":[\n" to:stream
  for i = 1 to nodes.count do (
    format "%" (vlNodeJson nodes[i] i) to:stream
    if i < nodes.count then format ",\n" to:stream else format "\n" to:stream
  )
  format "],\n\"simulation\":{\"dt\":0.002,\"substeps_per_frame\":4,\"playback_speed\":1,\"fps_cap\":60,\"damping_enabled\":false,\"damping_factor\":0.997,\"integrator\":\"SYMPLECTIC_EULER\",\"operator_name\":\"POINT_CUBATURE_IMPORTED\",\"evaluation_method\":\"DISTRIBUTED_ELEMENTS\"},\n\"first_hit\":{\"enabled\":false,\"observer_body_id\":null,\"direction_count\":16384,\"max_distance\":20,\"mode\":\"SKY_VIEW\"},\n\"kou\":null,\n\"provenance\":{\"source\":\"VoxelLabSceneExporter.ms\",\"producer_commit\":\"3DSMAX_LOCAL_EXPORT\",\"claim_ceiling\":\"PREVIEW_IMPORT_ONLY\"}\n}\n" to:stream
  close stream
  messageBox ("VoxelLab scene exported:\n" + outputPath)
)

rollout VoxelLabSceneExporter "VoxelLab Scene Exporter V2" width:330 (
  checkbox selectedOnly "Export selected objects" checked:true
  button exportButton "Export *.voxellab.scene.json" width:300
  label note "Defaults are documented in the public interface; inspect custom vl_* properties."
  on exportButton pressed do (
    local nodes = if selectedOnly.checked then selection as array else objects as array
    if nodes.count == 0 then messageBox "No objects to export." else (
      local path = getSaveFileName caption:"Export VoxelLab Scene V2" types:"VoxelLab scene (*.voxellab.scene.json)|*.voxellab.scene.json|"
      if path != undefined do vlExport nodes path
    )
  )
)
createDialog VoxelLabSceneExporter
